using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Domain.Entities;
using ExpenseTracker.Domain.Exceptions;

namespace ExpenseTracker.Application.Auth;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IRefreshTokenService _refreshTokenService;
    private readonly ISecurityEventLogger _securityEventLogger;

    public AuthService(
        IUserRepository userRepository,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        IRefreshTokenService refreshTokenService,
        ISecurityEventLogger securityEventLogger)
    {
        _userRepository = userRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _refreshTokenService = refreshTokenService;
        _securityEventLogger = securityEventLogger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        // Check for duplicate email
        var exists = await _userRepository.ExistsByEmailAsync(request.Email);
        if (exists)
        {
            await _securityEventLogger.LogRegisterFailureDuplicateAsync(request.Email);
            throw new DomainValidationException($"A user with email '{request.Email}' already exists.");
        }

        // Hash the password
        var passwordHash = _passwordHasher.HashPassword(request.Password);

        // Create user entity
        var user = new User(request.Email, passwordHash, request.DisplayName);

        // Persist user
        await _userRepository.AddAsync(user);

        // Generate tokens
        var jwtResult = _jwtTokenService.GenerateToken(user.Id, user.Email);
        var (refreshPlaintext, refreshTokenEntity) = await _refreshTokenService.GenerateAsync(user.Id);

        await _securityEventLogger.LogRegisterSuccessAsync(user.Id, user.Email);

        return new AuthResponse(
            new AccessTokenDto(jwtResult.Token, jwtResult.ExpiresAt),
            refreshPlaintext,
            refreshTokenEntity.ExpiresAt,
            new UserDto(user.Id, user.Email, user.DisplayName));
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        // Find user by email
        var user = await _userRepository.FindByEmailAsync(request.Email);
        if (user is null)
        {
            await _securityEventLogger.LogLoginFailureUnknownUserAsync(request.Email);
            throw new DomainValidationException("Invalid credentials.");
        }

        // Verify password
        var isValid = _passwordHasher.VerifyPassword(request.Password, user.PasswordHash);
        if (!isValid)
        {
            await _securityEventLogger.LogLoginFailureBadPasswordAsync(user.Id, request.Email);
            throw new DomainValidationException("Invalid credentials.");
        }

        // Generate tokens
        var jwtResult = _jwtTokenService.GenerateToken(user.Id, user.Email);
        var (refreshPlaintext, refreshTokenEntity) = await _refreshTokenService.GenerateAsync(user.Id);

        await _securityEventLogger.LogLoginSuccessAsync(user.Id, user.Email);

        return new AuthResponse(
            new AccessTokenDto(jwtResult.Token, jwtResult.ExpiresAt),
            refreshPlaintext,
            refreshTokenEntity.ExpiresAt,
            new UserDto(user.Id, user.Email, user.DisplayName));
    }

    public async Task<AuthResponse> RefreshAsync(string plaintextRefreshToken)
    {
        // Validate the refresh token (throws if invalid/expired/revoked)
        var currentToken = await _refreshTokenService.ValidateAsync(plaintextRefreshToken);

        // Rotate the token (revoke old, create new)
        var (newPlaintext, newRefreshTokenEntity) = await _refreshTokenService.RotateAsync(currentToken);

        // Find the user to generate a new access token
        var user = await _userRepository.FindByIdAsync(currentToken.UserId)
            ?? throw new NotFoundException("User", currentToken.UserId);

        var jwtResult = _jwtTokenService.GenerateToken(user.Id, user.Email);

        await _securityEventLogger.LogRefreshSuccessAsync(user.Id, currentToken.Id, newRefreshTokenEntity.Id);

        return new AuthResponse(
            new AccessTokenDto(jwtResult.Token, jwtResult.ExpiresAt),
            newPlaintext,
            newRefreshTokenEntity.ExpiresAt,
            new UserDto(user.Id, user.Email, user.DisplayName));
    }

    public async Task LogoutAsync(string plaintextRefreshToken)
    {
        var token = await _refreshTokenService.ValidateAsync(plaintextRefreshToken);
        await _refreshTokenService.RevokeAsync(token);
        // Note: auth.logout.success is logged by AuthController.Logout which
        // resolves the tokenId from the validated token via _refreshTokenService.
    }

    public async Task<UserDto> GetMeAsync(Guid userId)
    {
        var user = await _userRepository.FindByIdAsync(userId)
            ?? throw new NotFoundException("User", userId);

        return new UserDto(user.Id, user.Email, user.DisplayName);
    }
}
