## Description

<!-- Provide a clear and concise description of your changes -->

## Type of Change

<!-- Check the relevant option(s) -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring
- [ ] Test additions or improvements
- [ ] Build/CI configuration

## Related Issues

<!-- Link to related issues using #issue_number -->

Closes #

## Changes Made

<!-- List the specific changes made in this PR -->

-
-
-

## Testing

<!-- Describe how you tested these changes -->

### Test Coverage

- [ ] All existing tests pass (`make test`)
- [ ] New tests added for new functionality
- [ ] Test coverage maintained or improved

### Manual Testing

<!-- Describe manual testing performed -->

**Test Environment:**
- OS:
- Runtime: Node.js / Bun (version: )
- TSFulmen version:

**Steps taken:**
1.
2.
3.

## Documentation

- [ ] Code is self-documenting with clear function/variable names
- [ ] JSDoc comments added for public APIs
- [ ] README.md updated (if needed)
- [ ] Migration guide provided (for breaking changes)
- [ ] Examples updated (if applicable)

## Quality Checks

<!-- Confirm that quality checks pass -->

- [ ] `make check-all` passes (lint, typecheck, test)
- [ ] `make build` succeeds
- [ ] No TypeScript errors in strict mode
- [ ] Biome formatting applied
- [ ] No new warnings introduced

## Cross-Language Alignment

<!-- For core module changes that should align with gofulmen/pyfulmen -->

- [ ] Not applicable (TypeScript-specific or internal change)
- [ ] Coordination needed with gofulmen (Go)
- [ ] Coordination needed with pyfulmen (Python)
- [ ] Breaking change discussed with ecosystem team

## Security Considerations

<!-- Address any security implications -->

- [ ] No security implications
- [ ] Security review requested
- [ ] New dependencies security-audited (`bun audit`)
- [ ] Input validation added for user-facing APIs
- [ ] No secrets or credentials committed

## Pre-submission Checklist

<!-- Complete before requesting review -->

- [ ] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
- [ ] My code follows the project's coding standards
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] All CI checks pass
- [ ] I have updated documentation as needed
- [ ] My changes do not introduce new dependencies without discussion
- [ ] Commit messages follow the project's commit message standards

## Additional Notes

<!-- Any additional information that reviewers should know -->

---

**Note**: TSFulmen is currently in alpha (v0.1.x). We are focusing on core stability and are not yet accepting feature PRs unless pre-approved. For feature requests, please open an issue first to discuss.
