namespace ExpenseTracker.Application.Auth.DTOs;

public record RegisterRequest(string Email, string Password, string DisplayName);

public record LoginRequest(string Email, string Password);

public record AuthResponse(
    AccessTokenDto AccessToken,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    UserDto User);

public record AccessTokenDto(string Token, DateTimeOffset ExpiresAt);

public record UserDto(Guid Id, string Email, string DisplayName);
