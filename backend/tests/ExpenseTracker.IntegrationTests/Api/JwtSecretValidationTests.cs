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

    // --- A4 (R5): the fail-fast message must guide operators to user-secrets ----

    [Fact]
    public void Production_fail_fast_message_mentions_user_secrets()
    {
        var factory = CreateFactory("");

        var act = () => factory.CreateClient();

        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*user-secrets*");
    }

    [Fact]
    public void Production_fail_fast_message_mentions_environment_variable()
    {
        var factory = CreateFactory("");

        var act = () => factory.CreateClient();

        // Env-var name on the message (Windows-style, double underscore) so an
        // operator on a container host knows the override key.
        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*Jwt__SecretKey*");
    }

    [Fact]
    public void Production_fail_fast_message_mentions_user_secrets_set_command()
    {
        var factory = CreateFactory("");

        var act = () => factory.CreateClient();

        // The actionable command: "dotnet user-secrets set Jwt:SecretKey ...".
        // Just checking the substring "dotnet user-secrets set" pins the verb —
        // the operator must see an actual command, not just a hint.
        act.Should().Throw<InvalidOperationException>()
           .WithMessage("*dotnet user-secrets set*Jwt*SecretKey*");
    }
}
