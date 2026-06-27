using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Exceptions;
using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace ExpenseTracker.UnitTests.Auth;

public class AuthServiceTests
{
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly IJwtTokenService _jwtTokenService = Substitute.For<IJwtTokenService>();
    private readonly IRefreshTokenService _refreshTokenService = Substitute.For<IRefreshTokenService>();
    private readonly ISecurityEventLogger _securityEventLogger = Substitute.For<ISecurityEventLogger>();
    private readonly AuthService _sut;

    private static readonly Guid TestUserId = Guid.NewGuid();
    private static readonly string TestEmail = "test@example.com";
    private static readonly DateTimeOffset TestTokenExpiry = DateTimeOffset.UtcNow.AddMinutes(15);

    public AuthServiceTests()
    {
        _sut = new AuthService(
            _userRepository,
            _passwordHasher,
            _jwtTokenService,
            _refreshTokenService,
            _securityEventLogger);
    }

    private static RefreshToken CreateRefreshToken(
        Guid? userId = null,
        string? tokenHash = null,
        DateTimeOffset? expiresAt = null)
    {
        return new RefreshToken(userId ?? TestUserId, tokenHash ?? "token_hash", expiresAt ?? DateTimeOffset.UtcNow.AddDays(7));
    }

    // ==================== Register ====================

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Register_creates_user_and_returns_tokens()
    {
        // Arrange
        var request = new RegisterRequest(TestEmail, "password123", "Test User");

        _userRepository.ExistsByEmailAsync(TestEmail).Returns(false);
        _passwordHasher.HashPassword("password123").Returns("hashed_password");
        _jwtTokenService.GenerateToken(Arg.Any<Guid>(), TestEmail).Returns(_ => new JwtTokenResult("jwt_token", TestTokenExpiry));
        _refreshTokenService.GenerateAsync(Arg.Any<Guid>())
            .Returns(_ => ("plaintext_refresh_token", CreateRefreshToken()));

        // Act
        var response = await _sut.RegisterAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.AccessToken.Should().NotBeNull();
        response.AccessToken.Token.Should().NotBeNullOrWhiteSpace();
        response.AccessToken.ExpiresAt.Should().Be(TestTokenExpiry);
        response.User.Should().NotBeNull();
        response.User.Email.Should().Be(TestEmail);
        response.User.DisplayName.Should().Be("Test User");

        await _userRepository.Received(1).AddAsync(Arg.Any<User>());
        await _refreshTokenService.Received(1).GenerateAsync(Arg.Any<Guid>());
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Register_rejects_duplicate_email()
    {
        // Arrange
        var request = new RegisterRequest(TestEmail, "password123", "Test User");
        _userRepository.ExistsByEmailAsync(TestEmail).Returns(true);

        // Act & Assert
        await _sut.Invoking(s => s.RegisterAsync(request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*already exists*");

        await _userRepository.DidNotReceive().AddAsync(Arg.Any<User>());
    }

    // ==================== Login ====================

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Login_with_correct_password_returns_tokens()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, "password123");
        var existingUser = new User(TestEmail, "hashed_password", "Test User");

        _userRepository.FindByEmailAsync(TestEmail).Returns(existingUser);
        _passwordHasher.VerifyPassword("password123", "hashed_password").Returns(true);
        _jwtTokenService.GenerateToken(existingUser.Id, TestEmail).Returns(_ => new JwtTokenResult("jwt_token", TestTokenExpiry));
        _refreshTokenService.GenerateAsync(existingUser.Id)
            .Returns(_ => ("plaintext_refresh", CreateRefreshToken(existingUser.Id)));

        // Act
        var response = await _sut.LoginAsync(request);

        // Assert
        response.Should().NotBeNull();
        response.AccessToken.Should().NotBeNull();
        response.AccessToken.Token.Should().NotBeNullOrWhiteSpace();
        response.User.Email.Should().Be(TestEmail);
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Login_with_wrong_password_throws_InvalidCredentials()
    {
        // Arrange
        var request = new LoginRequest(TestEmail, "wrong_password");
        var existingUser = new User(TestEmail, "hashed_password", "Test User");

        _userRepository.FindByEmailAsync(TestEmail).Returns(existingUser);
        _passwordHasher.VerifyPassword("wrong_password", "hashed_password").Returns(false);

        // Act & Assert
        await _sut.Invoking(s => s.LoginAsync(request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*Invalid credentials*");
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Login_with_nonexistent_email_throws_InvalidCredentials()
    {
        // Arrange
        var request = new LoginRequest("nobody@example.com", "password123");
        _userRepository.FindByEmailAsync("nobody@example.com").Returns((User?)null);

        // Act & Assert
        await _sut.Invoking(s => s.LoginAsync(request))
            .Should().ThrowAsync<DomainValidationException>()
            .WithMessage("*Invalid credentials*");
    }

    // ==================== Refresh ====================

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Refresh_rotates_token_and_revokes_old()
    {
        // Arrange
        var user = new User(TestEmail, "hashed", "Test User");
        var currentToken = CreateRefreshToken(user.Id);

        _refreshTokenService.ValidateAsync("plaintext_old_token").Returns(currentToken);
        _refreshTokenService.RotateAsync(currentToken)
            .Returns(_ => ("plaintext_new_token", CreateRefreshToken(user.Id, "new_hash")));
        _userRepository.FindByIdAsync(user.Id).Returns(user);
        _jwtTokenService.GenerateToken(user.Id, TestEmail).Returns(_ => new JwtTokenResult("jwt_token", TestTokenExpiry));

        // Act
        var response = await _sut.RefreshAsync("plaintext_old_token");

        // Assert
        response.Should().NotBeNull();
        response.AccessToken.Should().NotBeNull();
        response.AccessToken.Token.Should().NotBeNullOrWhiteSpace();
        await _refreshTokenService.Received(1).RotateAsync(currentToken);
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Refresh_with_revoked_token_throws()
    {
        // Arrange
        _refreshTokenService.ValidateAsync("revoked_token")
            .ThrowsAsync(new RefreshTokenValidationException("Token has been revoked"));

        // Act & Assert
        await _sut.Invoking(s => s.RefreshAsync("revoked_token"))
            .Should().ThrowAsync<RefreshTokenValidationException>()
            .WithMessage("*revoked*");
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Refresh_with_expired_token_throws()
    {
        // Arrange
        _refreshTokenService.ValidateAsync("expired_token")
            .ThrowsAsync(new RefreshTokenValidationException("Token has expired"));

        // Act & Assert
        await _sut.Invoking(s => s.RefreshAsync("expired_token"))
            .Should().ThrowAsync<RefreshTokenValidationException>()
            .WithMessage("*expired*");
    }

    // ==================== Logout ====================

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Logout_revokes_token()
    {
        // Arrange
        var token = CreateRefreshToken();
        _refreshTokenService.ValidateAsync("plaintext_token").Returns(token);

        // Act
        await _sut.LogoutAsync("plaintext_token");

        // Assert
        await _refreshTokenService.Received(1).RevokeAsync(token);
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task Logout_with_invalid_token_throws()
    {
        // Arrange
        _refreshTokenService.ValidateAsync("bad_token")
            .ThrowsAsync(new RefreshTokenValidationException("Token not found"));

        // Act & Assert
        await _sut.Invoking(s => s.LogoutAsync("bad_token"))
            .Should().ThrowAsync<RefreshTokenValidationException>();
    }

    // ==================== GetMe ====================

    [Fact]
    [Trait("Category", "Auth")]
    public async Task GetMe_returns_user_dto()
    {
        // Arrange
        var user = new User(TestEmail, "hashed", "Test User");
        _userRepository.FindByIdAsync(user.Id).Returns(user);

        // Act
        var result = await _sut.GetMeAsync(user.Id);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(user.Id);
        result.Email.Should().Be(TestEmail);
        result.DisplayName.Should().Be("Test User");
    }

    [Fact]
    [Trait("Category", "Auth")]
    public async Task GetMe_with_nonexistent_user_throws_NotFound()
    {
        // Arrange
        var fakeId = Guid.NewGuid();
        _userRepository.FindByIdAsync(fakeId).Returns((User?)null);

        // Act & Assert
        await _sut.Invoking(s => s.GetMeAsync(fakeId))
            .Should().ThrowAsync<NotFoundException>();
    }
}
