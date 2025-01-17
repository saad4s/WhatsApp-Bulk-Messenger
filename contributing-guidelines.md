# Contributing to WhatsApp Bulk Messenger

Thank you for your interest in contributing to WhatsApp Bulk Messenger! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors. We expect all participants to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

1. Check the GitHub Issues to ensure the bug hasn't been reported already
2. If not found, create a new issue with the following information:
   - Clear, descriptive title
   - Detailed description of the issue
   - Steps to reproduce the problem
   - Expected behavior
   - Actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, Node.js version, etc.)

### Suggesting Enhancements

1. Check existing issues and pull requests to avoid duplicates
2. Create a new issue describing your enhancement:
   - Explain the current behavior
   - Describe the proposed enhancement
   - Provide examples of how this would improve the project
   - Consider potential drawbacks or challenges

### Pull Request Process

1. Fork the repository
2. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   or
   ```bash
   git checkout -b fix/your-fix-name
   ```

3. Make your changes following our coding standards:
   - Use consistent indentation (2 spaces)
   - Follow JavaScript/Node.js best practices
   - Add comments for complex logic
   - Update documentation as needed

4. Test your changes thoroughly
   - Ensure existing functionality isn't broken
   - Add new tests if necessary
   - Verify all tests pass

5. Commit your changes:
   - Use clear, descriptive commit messages
   - Reference related issues using `#issue-number`
   ```bash
   git commit -m "Add feature: description (#123)"
   ```

6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Submit a pull request:
   - Provide a clear title and description
   - Link related issues
   - Include screenshots for UI changes
   - List any breaking changes
   - Update documentation if needed

## Development Setup

1. Install prerequisites:
   - Node.js (v14.0.0 or higher)
   - npm
   - Git

2. Fork and clone the repository:
   ```bash
   git clone https://github.com/saad4s/whatsapp-bulk-messenger.git
   cd whatsapp-bulk-messenger
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create required directories:
   ```bash
   mkdir uploads
   ```

## Coding Standards

### JavaScript

- Use ES6+ features when appropriate
- Follow airbnb-style guide
- Use meaningful variable and function names
- Add JSDoc comments for functions
- Maintain reasonable function length (max 20-30 lines)

### HTML/CSS

- Use semantic HTML elements
- Follow BEM naming convention for CSS classes
- Maintain mobile-first responsive design
- Ensure accessibility standards

### Git Commits

- Use present tense ("Add feature" not "Added feature")
- Be descriptive but concise
- Reference issues and pull requests when relevant
- Separate subject from body with a blank line
- Use the body to explain what and why vs. how

## Documentation

- Update README.md for new features or changes
- Add JSDoc comments for new functions
- Update API documentation if endpoints change
- Include code examples where helpful
- Keep documentation clear and concise

## Testing

- Write tests for new features
- Update existing tests for changes
- Ensure all tests pass before submitting PR
- Include both unit and integration tests
- Test edge cases and error conditions

## Review Process

1. Maintainers will review PRs as soon as possible
2. Changes may be requested before merging
3. At least one maintainer approval is required
4. CI checks must pass
5. Documentation must be updated

## Release Process

1. Version numbers follow semantic versioning
2. Changelog must be updated
3. Release notes should be comprehensive
4. Tags should be signed

## Questions or Need Help?

- Open a GitHub issue for general questions
- Join our community discussion forum
- Contact maintainers directly for sensitive issues

Thank you for contributing to WhatsApp Bulk Messenger!
