using Metup.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Metup.Infrastructure.Security;

public class PasswordHasher : IPasswordHasher
{
    private readonly PasswordHasher<object> _hasher = new();
    private static readonly object DummyUser = new();

    public string Hash(string password) => _hasher.HashPassword(DummyUser, password);

    public bool Verify(string passwordHash, string providedPassword) =>
        _hasher.VerifyHashedPassword(DummyUser, passwordHash, providedPassword) != PasswordVerificationResult.Failed;
}
