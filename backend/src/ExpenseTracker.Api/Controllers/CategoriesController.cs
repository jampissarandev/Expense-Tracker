using ExpenseTracker.Application.Abstractions;
using ExpenseTracker.Application.Categories;
using ExpenseTracker.Application.Categories.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ExpenseTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("GlobalRateLimit")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;
    private readonly ICurrentUserService _currentUserService;

    public CategoriesController(
        ICategoryService categoryService,
        ICurrentUserService currentUserService)
    {
        _categoryService = categoryService;
        _currentUserService = currentUserService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> List()
    {
        var userId = GetRequiredUserId();
        var categories = await _categoryService.ListAsync(userId);
        return Ok(categories);
    }

    [HttpPost]
    [RequestSizeLimit(64_000)]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CreateCategoryRequest request)
    {
        var userId = GetRequiredUserId();
        var category = await _categoryService.CreateAsync(userId, request);
        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CategoryDto>> GetById(Guid id)
    {
        var userId = GetRequiredUserId();
        var categories = await _categoryService.ListAsync(userId);
        var category = categories.FirstOrDefault(c => c.Id == id);
        if (category is null)
            return NotFound();
        return Ok(category);
    }

    [HttpPut("{id:guid}")]
    [RequestSizeLimit(64_000)]
    public async Task<ActionResult<CategoryDto>> Update(Guid id, [FromBody] UpdateCategoryRequest request)
    {
        var userId = GetRequiredUserId();
        var category = await _categoryService.UpdateAsync(userId, id, request);
        return Ok(category);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetRequiredUserId();
        await _categoryService.DeleteAsync(userId, id);
        return NoContent();
    }

    private Guid GetRequiredUserId()
    {
        return _currentUserService.UserId
            ?? throw new UnauthorizedAccessException("User is not authenticated.");
    }
}
