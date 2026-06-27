namespace ExpenseTracker.IntegrationTests.Api;

/// <summary>
/// Shared test constants. Kept in one place so the dev secret used by the
/// in-process API is consistent across every test fixture and is not duplicated
/// in any tracked <c>appsettings*.json</c> file.
/// </summary>
internal static class TestSettings
{
    /// <summary>
    /// The 32+ char JWT signing key the test <see cref="Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory{TEntryPoint}"/>
    /// wires into the API in lieu of a real <c>dotnet user-secrets</c> store.
    /// Must be at least 32 characters so it passes the same length check the
    /// app applies in non-Development environments.
    /// </summary>
    public const string JwtSecretKey = "TestSuperSecretKey_ThisIsAtLeast32CharsLong!";
}
