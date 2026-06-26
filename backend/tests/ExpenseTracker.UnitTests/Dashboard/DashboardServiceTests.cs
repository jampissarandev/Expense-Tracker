using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Domain.Enums;
using FluentAssertions;
using NSubstitute;

namespace ExpenseTracker.UnitTests.Dashboard;

/// <summary>
/// Regression tests for <see cref="DashboardService"/>.
/// </summary>
/// <remarks>
/// <para>
/// The dashboard service composes three repository calls. The original
/// implementation ran them in parallel via <c>Task.WhenAll</c> against a
/// single <c>ExpenseTrackerDbContext</c>. EF Core's <c>DbContext</c> is
/// **not thread-safe** — concurrent queries on the same instance throw
/// <c>InvalidOperationException: A second operation was started on this
/// context instance...</c>. This was reproduced against the real
/// PostgreSQL database during the Phase 2 manual smoke test (first call
/// succeeded, second call returned 500) but never by the InMemory-based
/// integration tests.
/// </para>
/// <para>
/// The fix: await the three calls sequentially. The tests below pin
/// that behaviour so a future refactor can't re-introduce the race.
/// </para>
/// </remarks>
[Trait("Category", "Dashboard")]
public class DashboardServiceTests
{
    private static readonly Guid TestUserId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public async Task GetSummaryAsync_returns_combined_payload()
    {
        var repo = Substitute.For<IDashboardRepository>();
        repo.GetCurrentMonthTotalsAsync(TestUserId).Returns(new CurrentMonthTotals(50_000m, 8_000m, 2026, 6));
        repo.GetLast6MonthsAsync(TestUserId).Returns(new List<MonthlyAggregate>
        {
            new(2026, 1, 50_000m, 0m),
            new(2026, 2, 52_000m, 0m),
            new(2026, 3, 50_000m, 0m),
            new(2026, 4, 0m, 3_500m),
            new(2026, 5, 0m, 1_200m),
            new(2026, 6, 0m, 0m),
        });
        repo.GetByCategoryAsync(TestUserId, TransactionType.Expense).Returns(new List<CategoryAggregate>
        {
            new(Guid.NewGuid(), "Food", 5_000m, 10),
        });

        var sut = new DashboardService(repo);

        var result = await sut.GetSummaryAsync(TestUserId);

        result.CurrentMonth.Income.Should().Be(50_000m);
        result.CurrentMonth.Expense.Should().Be(8_000m);
        result.CurrentMonth.Balance.Should().Be(42_000m);
        result.Last6Months.Should().HaveCount(6);
        result.ByCategory.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetSummaryAsync_defaults_byCategory_type_to_Expense_when_type_not_specified()
    {
        var repo = Substitute.For<IDashboardRepository>();
        repo.GetCurrentMonthTotalsAsync(TestUserId).Returns(new CurrentMonthTotals(0m, 0m, 2026, 6));
        repo.GetLast6MonthsAsync(TestUserId).Returns(new List<MonthlyAggregate>());
        repo.GetByCategoryAsync(TestUserId, TransactionType.Expense).Returns(new List<CategoryAggregate>());

        var sut = new DashboardService(repo);

        _ = await sut.GetSummaryAsync(TestUserId);

        await repo.Received(1).GetByCategoryAsync(TestUserId, TransactionType.Expense);
    }

    [Fact]
    public async Task GetSummaryAsync_uses_specified_type_for_byCategory()
    {
        var repo = Substitute.For<IDashboardRepository>();
        repo.GetCurrentMonthTotalsAsync(TestUserId).Returns(new CurrentMonthTotals(0m, 0m, 2026, 6));
        repo.GetLast6MonthsAsync(TestUserId).Returns(new List<MonthlyAggregate>());
        repo.GetByCategoryAsync(TestUserId, TransactionType.Income).Returns(new List<CategoryAggregate>());

        var sut = new DashboardService(repo);

        _ = await sut.GetSummaryAsync(TestUserId, TransactionType.Income);

        await repo.Received(1).GetByCategoryAsync(TestUserId, TransactionType.Income);
    }

    /// <summary>
    /// Regression: repository calls must be awaited sequentially, not fired
    /// in parallel. A parallel implementation would call all three
    /// repository methods up-front (visible to a "started" recorder) before
    /// the first one completed. A sequential implementation only starts
    /// the second call after the first one returns.
    /// </summary>
    [Fact]
    public async Task GetSummaryAsync_does_not_run_repository_calls_in_parallel()
    {
        // Use TaskCompletionSources so the test can hold each call open
        // and observe the call order deterministically (no Task.Delay).
        // A "started" latch is signalled the moment a call begins; the
        // assertion code awaits the next-call latch *after* releasing the
        // previous one, which proves the next call did not start until
        // the previous one completed. A parallel implementation would
        // record all three "start" signals before any of them is
        // released, which the assertions detect.
        var callOrder = new List<string>();
        var startedLatches = new Dictionary<string, TaskCompletionSource>
        {
            ["currentMonth"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
            ["last6Months"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
            ["byCategory"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
        };
        var releaseLatches = new Dictionary<string, TaskCompletionSource>
        {
            ["currentMonth"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
            ["last6Months"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
            ["byCategory"] = new(TaskCreationOptions.RunContinuationsAsynchronously),
        };

        var repo = Substitute.For<IDashboardRepository>();
        repo.GetCurrentMonthTotalsAsync(TestUserId).Returns(async _ =>
        {
            lock (callOrder) { callOrder.Add("currentMonth:start"); }
            startedLatches["currentMonth"].TrySetResult();
            await releaseLatches["currentMonth"].Task.ConfigureAwait(false);
            return new CurrentMonthTotals(0m, 0m, 2026, 6);
        });
        repo.GetLast6MonthsAsync(TestUserId).Returns(async _ =>
        {
            lock (callOrder) { callOrder.Add("last6Months:start"); }
            startedLatches["last6Months"].TrySetResult();
            await releaseLatches["last6Months"].Task.ConfigureAwait(false);
            return (IReadOnlyList<MonthlyAggregate>)new List<MonthlyAggregate>();
        });
        repo.GetByCategoryAsync(TestUserId, TransactionType.Expense).Returns(async _ =>
        {
            lock (callOrder) { callOrder.Add("byCategory:start"); }
            startedLatches["byCategory"].TrySetResult();
            await releaseLatches["byCategory"].Task.ConfigureAwait(false);
            return (IReadOnlyList<CategoryAggregate>)new List<CategoryAggregate>();
        });

        var sut = new DashboardService(repo);
        var summaryTask = sut.GetSummaryAsync(TestUserId);

        // Wait deterministically for the first call to start.
        await startedLatches["currentMonth"].Task;
        lock (callOrder)
        {
            callOrder.Count.Should().Be(1, "only the first call should have started");
            callOrder[0].Should().Be("currentMonth:start");
        }

        // Release the first call. The second call is then allowed to
        // start; wait deterministically for it.
        releaseLatches["currentMonth"].TrySetResult();
        await startedLatches["last6Months"].Task;
        lock (callOrder)
        {
            callOrder.Should().Contain("last6Months:start");
            callOrder.Count.Should().Be(2, "the second call should start only after the first completes");
        }

        // Release the second. The third is then allowed to start.
        releaseLatches["last6Months"].TrySetResult();
        await startedLatches["byCategory"].Task;
        lock (callOrder)
        {
            callOrder.Should().Contain("byCategory:start");
            callOrder.Count.Should().Be(3, "the third call should start only after the second completes");
        }

        // Release the third and let the service return.
        releaseLatches["byCategory"].TrySetResult();
        var summary = await summaryTask;
        summary.Should().NotBeNull();
    }

    private static async Task<T> AwaitAsync<T>(Task task)
    {
        await task.ConfigureAwait(false);
        return default!;
    }
}

