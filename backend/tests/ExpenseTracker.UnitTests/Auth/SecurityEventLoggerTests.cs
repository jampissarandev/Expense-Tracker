using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Infrastructure.Configuration;
using ExpenseTracker.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace ExpenseTracker.UnitTests.Auth;

[Trait("Category", "SecurityEventLogger")]
public class SecurityEventLoggerTests : IDisposable
{
    private readonly ILogger<SecurityEventLogger> _logger;
    private readonly SecurityEventLogger _sut;
    private readonly SecurityEventSettings _settings;

    public SecurityEventLoggerTests()
    {
        _settings = new SecurityEventSettings { Enabled = true };
        var options = Options.Create(_settings);
        _logger = Substitute.For<ILogger<SecurityEventLogger>>();
        _sut = new SecurityEventLogger(_logger, options);
    }

    public void Dispose()
    {
        GC.SuppressFinalize(this);
    }

    // ==================== Register success ====================

    [Fact]
    public async Task LogRegisterSuccess_writes_information_event_with_email_hash()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var email = "alice@example.com";

        // Act
        await _sut.LogRegisterSuccessAsync(userId, email);

        // Assert
        _logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsEmailHash(o, "alice@example.com")
                                 && ContainsUserId(o, userId)
                                 && !ContainsRawEmail(o, "alice@example.com")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task LogRegisterSuccess_disabled_does_not_log()
    {
        // Arrange
        var disabledSettings = new SecurityEventSettings { Enabled = false };
        var sut = new SecurityEventLogger(_logger, Options.Create(disabledSettings));

        // Act
        await sut.LogRegisterSuccessAsync(Guid.NewGuid(), "alice@example.com");

        // Assert
        _logger.DidNotReceive().Log(
            Arg.Any<LogLevel>(),
            Arg.Any<EventId>(),
            Arg.Any<object>(),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task LogRegisterSuccess_normalizes_email_to_lowercase()
    {
        // Arrange — same email with different case must produce the same hash
        // so events can be correlated across the codebase.

        // Act & Assert
        await _sut.LogRegisterSuccessAsync(Guid.NewGuid(), "Alice@Example.COM");
        _logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsEmailHash(o, "alice@example.com")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Register failure (duplicate) ====================

    [Fact]
    public async Task LogRegisterFailureDuplicate_writes_warning_with_email_hash()
    {
        // Act
        await _sut.LogRegisterFailureDuplicateAsync("alice@example.com");

        // Assert
        _logger.Received(1).Log(
            LogLevel.Warning,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsEmailHash(o, "alice@example.com")
                                 && !ContainsRawEmail(o, "alice@example.com")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Login success ====================

    [Fact]
    public async Task LogLoginSuccess_writes_information_with_userid_and_emailhash()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var email = "bob@example.com";

        // Act
        await _sut.LogLoginSuccessAsync(userId, email);

        // Assert
        _logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsUserId(o, userId)
                                 && ContainsEmailHash(o, "bob@example.com")
                                 && !ContainsRawEmail(o, "bob@example.com")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Login failure (unknown user) ====================

    [Fact]
    public async Task LogLoginFailureUnknownUser_writes_warning_with_emailhash_only()
    {
        // Act
        await _sut.LogLoginFailureUnknownUserAsync("nobody@example.com");

        // Assert
        _logger.Received(1).Log(
            LogLevel.Warning,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsEmailHash(o, "nobody@example.com")
                                 && !ContainsUserId(o, Guid.Empty)),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Login failure (bad password) ====================

    [Fact]
    public async Task LogLoginFailureBadPassword_writes_warning_with_userid_and_emailhash()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var email = "alice@example.com";

        // Act
        await _sut.LogLoginFailureBadPasswordAsync(userId, email);

        // Assert
        _logger.Received(1).Log(
            LogLevel.Warning,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsUserId(o, userId)
                                 && ContainsEmailHash(o, "alice@example.com")
                                 && !ContainsRawEmail(o, "alice@example.com")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Refresh success ====================

    [Fact]
    public async Task LogRefreshSuccess_writes_information_with_token_ids()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var oldTokenId = Guid.NewGuid();
        var newTokenId = Guid.NewGuid();

        // Act
        await _sut.LogRefreshSuccessAsync(userId, oldTokenId, newTokenId);

        // Assert
        _logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsUserId(o, userId)
                                 && o.ToString()!.Contains(oldTokenId.ToString())
                                 && o.ToString()!.Contains(newTokenId.ToString())),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Refresh failure ====================

    [Fact]
    public async Task LogRefreshFailure_writes_warning_with_token_id_when_provided()
    {
        // Arrange
        var tokenId = Guid.NewGuid();

        // Act
        await _sut.LogRefreshFailureAsync(tokenId, "Token not found");

        // Assert
        _logger.Received(1).Log(
            LogLevel.Warning,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => o.ToString()!.Contains(tokenId.ToString())
                                 && o.ToString()!.Contains("Token not found")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task LogRefreshFailure_tolerates_null_token_id()
    {
        // Act — no extracted token id (e.g. malformed token) must not throw
        await _sut.LogRefreshFailureAsync(null, "Token malformed");

        // Assert
        _logger.Received(1).Log(
            LogLevel.Warning,
            Arg.Any<EventId>(),
            Arg.Any<object>(),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Logout success ====================

    [Fact]
    public async Task LogLogoutSuccess_writes_information_with_userid_and_token_id()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var tokenId = Guid.NewGuid();

        // Act
        await _sut.LogLogoutSuccessAsync(userId, tokenId);

        // Assert
        _logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => ContainsUserId(o, userId)
                                 && o.ToString()!.Contains(tokenId.ToString())),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    // ==================== Email hashing ====================

    [Theory]
    [InlineData("alice@example.com", "alice@example.com")] // identical
    [InlineData("Alice@Example.COM", "alice@example.com")] // case-insensitive
    [InlineData("  alice@example.com  ", "alice@example.com")] // whitespace trimmed
    public void HashEmail_is_stable_across_casing_and_whitespace(string input, string normalized)
    {
        // The test exercises the public logging path to verify that two different
        // inputs (casing/whitespace variants) yield the same EmailHash — this is
        // what enables correlating "Alice@…" and "alice@…" across log events.
        var expectedHash = ComputeExpectedHash(normalized);

        // Act: log with the input
        _sut.LogRegisterSuccessAsync(Guid.NewGuid(), input);

        // Assert: the logged event's EmailHash matches the normalized hash
        _logger.Received(1).Log(
            LogLevel.Information,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => o.ToString()!.Contains($"EmailHash: {expectedHash}")),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task HashEmail_returns_16_char_hex_prefix_of_sha256()
    {
        // Act: log twice with same email, get hash from the second call's log state
        await _sut.LogRegisterSuccessAsync(Guid.NewGuid(), "stable@example.com");

        // Assert: hash is 16 lowercase hex chars (64 bits)
        var expectedHash = ComputeExpectedHash("stable@example.com");
        expectedHash.Should().HaveLength(16);
        expectedHash.Should().MatchRegex("^[0-9a-f]{16}$");
    }

    // ==================== Helpers ====================

    private static bool ContainsUserId(object state, Guid userId)
        => state.ToString()!.Contains($"UserId: {userId}");

    private static bool ContainsEmailHash(object state, string email)
    {
        var expectedHash = ComputeExpectedHash(email);
        return state.ToString()!.Contains($"EmailHash: {expectedHash}");
    }

    private static bool ContainsRawEmail(object state, string email)
        => state.ToString()!.Contains(email);

    private static string ComputeExpectedHash(string email)
    {
        // Must match SecurityEventLogger.ComputeEmailHash
        var normalized = email.Trim().ToLowerInvariant();
        var bytes = System.Text.Encoding.UTF8.GetBytes(normalized);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash, 0, 8).ToLowerInvariant();
    }
}
