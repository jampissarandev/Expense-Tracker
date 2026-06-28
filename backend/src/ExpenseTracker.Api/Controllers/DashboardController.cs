using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Dashboard;
using ExpenseTracker.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ExpenseTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("GlobalRateLimit")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;
    private readonly ICurrentUserService _currentUserService;

    public DashboardController(
        IDashboardService dashboardService,
        ICurrentUserService currentUserService)
    {
        _dashboardService = dashboardService;
        _currentUserService = currentUserService;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(
        [FromQuery] TransactionType? type = null)
    {
        var userId = GetRequiredUserId();
        var summary = await _dashboardService.GetSummaryAsync(userId, type);
        return Ok(summary);
    }

    private Guid GetRequiredUserId() =>
        _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("User is not authenticated.");
}
