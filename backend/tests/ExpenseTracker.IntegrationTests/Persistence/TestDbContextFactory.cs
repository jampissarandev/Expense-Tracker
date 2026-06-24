using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;

namespace ExpenseTracker.IntegrationTests.Persistence;

public class TestDbContextFactory : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container;
    private IServiceScopeFactory? _scopeFactory;
    private bool _isDockerAvailable;

    public string ConnectionString => _container?.GetConnectionString() ?? string.Empty;

    public TestDbContextFactory()
    {
        try
        {
            _container = new PostgreSqlBuilder()
                .WithImage("postgres:16")
                .WithDatabase("expensetracker_test")
                .WithUsername("test")
                .WithPassword("test")
                .Build();
            _isDockerAvailable = true;
        }
        catch (Exception)
        {
            // Docker is not available (e.g., no Docker daemon in WSL from Windows)
            _isDockerAvailable = false;
            // Create a dummy container reference; we'll skip before using it
            _container = null!;
        }
    }

    public bool IsDockerAvailable => _isDockerAvailable;

    public async Task InitializeAsync()
    {
        if (!_isDockerAvailable)
            return;

        await _container.StartAsync();

        var services = new ServiceCollection();

        services.AddDbContext<ExpenseTrackerDbContext>(options =>
        {
            options.UseNpgsql(_container.GetConnectionString());
        });

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, FakeCurrentUserService>();

        var provider = services.BuildServiceProvider();
        _scopeFactory = provider.GetRequiredService<IServiceScopeFactory>();

        // Apply migrations to create the schema
        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ExpenseTrackerDbContext>();
        await context.Database.MigrateAsync();
    }

    public ExpenseTrackerDbContext CreateDbContext()
    {
        if (_scopeFactory is null)
            throw new InvalidOperationException("Factory not initialized or Docker not available.");

        var scope = _scopeFactory.CreateScope();
        return scope.ServiceProvider.GetRequiredService<ExpenseTrackerDbContext>();
    }

    /// <summary>
    /// Creates a scope with a settable <see cref="ICurrentUserService"/>, allowing tests
    /// to simulate different authenticated users and verify global query filters.
    /// </summary>
    public TestScope CreateScope()
    {
        if (_scopeFactory is null)
            throw new InvalidOperationException("Factory not initialized or Docker not available.");

        var scope = _scopeFactory.CreateScope();
        var fakeUser = (FakeCurrentUserService)scope.ServiceProvider.GetRequiredService<ICurrentUserService>();
        var context = scope.ServiceProvider.GetRequiredService<ExpenseTrackerDbContext>();
        return new TestScope(scope, context, fakeUser);
    }

    public async Task DisposeAsync()
    {
        if (_scopeFactory is not null)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ExpenseTrackerDbContext>();
            await context.Database.EnsureDeletedAsync();
        }

        if (_isDockerAvailable && _container is not null)
        {
            await _container.DisposeAsync();
        }
    }
}

public class TestScope : IDisposable
{
    private readonly IServiceScope _scope;

    public TestScope(IServiceScope scope, ExpenseTrackerDbContext context, FakeCurrentUserService currentUser)
    {
        _scope = scope;
        Context = context;
        CurrentUser = currentUser;
    }

    public ExpenseTrackerDbContext Context { get; }

    public Guid? CurrentUserId
    {
        get => CurrentUser.UserId;
        set => CurrentUser.UserId = value;
    }

    private FakeCurrentUserService CurrentUser { get; }

    public void Dispose() => _scope.Dispose();
}

public class FakeCurrentUserService : ICurrentUserService
{
    public Guid? UserId { get; set; }
}
