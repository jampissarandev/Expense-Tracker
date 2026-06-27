using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ExpenseTracker.IntegrationTests.Api;

/// <summary>
/// Verifies that the app refuses to start in non-Development environments
/// when Jwt:SecretKey is missing or too short (R-3).
/// </summary>
[Trait("Category", "JwtSecretValidation")]
public class JwtSecretValidationTests
{
    private static WebApplicationFactory<Program> CreateFactory(string secretKey)
    {
        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("Environment", "Production");
                builder.UseSetting("Jwt:SecretKey", secretKey);
                builder.UseSetting("Jwt:Issuer", "Test");
                builder.UseSetting("Jwt:Audience", "Test");
                builder.UseSetting("ConnectionStrings:DefaultConnection", "Host=localhost;Database=unused");
            });
    }

    [Fact]
    public void Production_empty_secret_key_throws_on_build()
    {
        var factory = CreateFactory("");

        var act = () => factory.CreateClient();

        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*SecretKey*32*");
    }

    [Fact]
    public void Production_short_secret_key_throws_on_build()
    {
        var factory = CreateFactory("short");

        var act = () => factory.CreateClient();

        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*SecretKey*32*");
    }

    [Fact]
    public void Production_valid_secret_key_does_not_throw()
    {
        var factory = CreateFactory("ThisIsAValidSecretKey_32Chars!!!");

        // Should not throw — just verify the client can be created.
        // (The app may fail later when it tries to connect to the DB,
        // but the JWT assertion should NOT fire.)
        var act = () => factory.CreateClient();

        act.Should().NotThrow<InvalidOperationException>();
    }
}
