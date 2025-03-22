# Fintonlabs - VSCode Extension for Agentic Code Generation

Fintonlabs is a powerful VS Code extension that uses AI to generate complete applications, components, and functions based on natural language descriptions. It supports multiple programming languages and frameworks, allowing you to rapidly create new projects or update existing ones.

![Fintonlabs Logo](media/fintonlabs-logo.svg)

## Features

- **Complete Application Generation** - Create entire applications from a text description
- **Multi-Framework Support** - Generate code for multiple languages and frameworks:
  - JavaScript/TypeScript: React, Vue, Angular, Express, Next.js
  - Python: FastAPI, Django, Flask
  - Java: Spring Boot, Android
  - C#: ASP.NET Core, WPF
  - Go: Web Server, CLI
  - Ruby: Rails
  - PHP: Laravel
  - Rust: Web Service, CLI
- **Update Existing Projects** - Add features to existing applications
- **Component Generation** - Create individual components
- **Function Generation** - Generate code for specific functions
- **Undo Functionality** - Track and revert file changes
- **Modern UI** - Clean, responsive user interface

## Installation

### From VSIX

1. Download the latest `.vsix` file from the [releases page](https://github.com/yourusername/fintonlabs/releases)
2. In VS Code, open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Select "Extensions: Install from VSIX..."
4. Choose the downloaded `.vsix` file

### From Source

1. Clone this repository
\`\`\`bash
git clone https://github.com/yourusername/fintonlabs.git
cd fintonlabs
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
\`\`\`

3. Build the extension
\`\`\`bash
npm run compile
\`\`\`

4. Package the extension
\`\`\`bash
npm install -g @vscode/vsce
vsce package
\`\`\`

5. Install the generated `.vsix` file in VS Code

## Configuration

Before using Fintonlabs, you need to configure it with your OpenAI API key:

1. Open VS Code Settings (Ctrl+, / Cmd+,)
2. Search for "Fintonlabs"
3. Enter your OpenAI API key in the "Fintonlabs: API Key" field
4. (Optional) Select your preferred AI model and adjust max tokens

## Usage

### Creating a New Application

1. Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Select "Fintonlabs: Create New Application"
3. Enter a detailed description of the application you want to create
4. Select a template/framework
5. Choose an output location
6. Click "Generate Application"

### Updating an Existing Application

1. Open the Command Palette
2. Select "Fintonlabs: Update Existing Application"
3. Enter new requirements or changes
4. Select the project to update
5. Click "Update Application"

### Generating Components

1. Open the Command Palette
2. Select "Fintonlabs: Generate Component"
3. Enter a description of the component
4. Select where to save the component
5. The component will be generated with appropriate code for the chosen framework

### Generating Functions

1. Position your cursor where you want the function to be inserted
2. Open the Command Palette
3. Select "Fintonlabs: Generate Function"
4. Enter a description of the function
5. The function will be inserted at the cursor position

### Undoing Operations

1. Open the Command Palette
2. Select "Fintonlabs: Undo Last Operation"
3. The most recent file operation will be undone

## Example

To create a simple to-do application, you might enter a description like:

\`\`\`
Create a to-do list application with the ability to add, edit, delete, and mark tasks as completed. 
Include local storage support to persist tasks between sessions. Add sorting by date and priority.
\`\`\`

Fintonlabs will generate a complete, working application based on this description.

## Advanced Features

### Token Management

For large projects, Fintonlabs uses a chunked generation approach to avoid token limits. It first creates the project structure, then generates each file individually.

### Error Handling

The extension provides detailed error messages and logs to help troubleshoot issues during code generation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add some amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- OpenAI for the GPT models that power the code generation
- VS Code team for the extension API

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.
