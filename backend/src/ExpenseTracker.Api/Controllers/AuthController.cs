using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Auth;
using ExpenseTracker.Application.Auth.DTOs;
using ExpenseTracker.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ExpenseTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("AuthRateLimit")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ICurrentUserService _currentUserService;
    private readonly IConfiguration _configuration;
    private readonly ISecurityEventLogger _securityEventLogger;
    private readonly IRefreshTokenService _refreshTokenService;

    private const string RefreshTokenCookieName = "et_rt";
    private const string RefreshTokenCookiePath = "/api/auth";

    public AuthController(
        IAuthService authService,
        ICurrentUserService currentUserService,
        IConfiguration configuration,
        ISecurityEventLogger securityEventLogger,
        IRefreshTokenService refreshTokenService)
    {
        _authService = authService;
        _currentUserService = currentUserService;
        _configuration = configuration;
        _securityEventLogger = securityEventLogger;
        _refreshTokenService = refreshTokenService;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [RequestSizeLimit(64_000)]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var response = await _authService.RegisterAsync(request);
        SetRefreshTokenCookie(response.RefreshToken, response.RefreshTokenExpiresAt);
        return Ok(response);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [RequestSizeLimit(64_000)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var response = await _authService.LoginAsync(request);
        SetRefreshTokenCookie(response.RefreshToken, response.RefreshTokenExpiresAt);
        return Ok(response);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        var plaintextToken = ReadRefreshTokenCookie();
        if (plaintextToken is null)
        {
            return Unauthorized(new ProblemDetails
            {
                Status = StatusCodes.Status401Unauthorized,
                Title = "Unauthorized",
                Detail = "Refresh token cookie is missing."
            });
        }

        var response = await _authService.RefreshAsync(plaintextToken);
        SetRefreshTokenCookie(response.RefreshToken, response.RefreshTokenExpiresAt);
        return Ok(response);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var plaintextToken = ReadRefreshTokenCookie();
        if (plaintextToken is not null)
        {
            // Validate first to get the token id, then revoke. If validation
            // fails (revoked/expired) we still want to clear the cookie, but
            // we cannot log a successful logout because we don't have a token id.
            try
            {
                var currentToken = await _refreshTokenService.ValidateAsync(plaintextToken);
                await _authService.LogoutAsync(plaintextToken);
                var userId = _currentUserService.UserId ?? currentToken.UserId;
                await _securityEventLogger.LogLogoutSuccessAsync(userId, currentToken.Id);
            }
            catch (RefreshTokenValidationException ex)
            {
                await _securityEventLogger.LogRefreshFailureAsync(null, $"logout: {ex.Message}");
            }
        }

        ClearRefreshTokenCookie();
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var userId = _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("User is not authenticated.");

        var userDto = await _authService.GetMeAsync(userId);
        return Ok(userDto);
    }

    private void SetRefreshTokenCookie(string plaintextToken, DateTimeOffset expiresAt)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = HttpContext.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = RefreshTokenCookiePath,
            Expires = expiresAt,
            IsEssential = true
        };

        Response.Cookies.Append(RefreshTokenCookieName, plaintextToken, cookieOptions);
    }

    private string? ReadRefreshTokenCookie()
    {
        return Request.Cookies.TryGetValue(RefreshTokenCookieName, out var token) ? token : null;
    }

    private void ClearRefreshTokenCookie()
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = HttpContext.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = RefreshTokenCookiePath,
            IsEssential = true
        };

        Response.Cookies.Delete(RefreshTokenCookieName, cookieOptions);
    }
}
