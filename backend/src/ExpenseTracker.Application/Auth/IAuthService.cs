using ExpenseTracker.Application.Auth.DTOs;

namespace ExpenseTracker.Application.Auth;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RefreshAsync(string plaintextRefreshToken);
    Task LogoutAsync(string plaintextRefreshToken);
    Task<UserDto> GetMeAsync(Guid userId);
}
