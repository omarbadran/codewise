# CodeWise

CodeWise is a powerful command-line tool designed to generate structured context from your codebase, making it easier to provide relevant information to Large Language Models (LLMs) for code-related tasks.

## Features

- Generates a full file tree of your project
- Includes contents of specified files
- Respects `.gitignore` and custom exclusion patterns
- Highly configurable via JSON file or command-line options
- Supports both XML and Markdown output formats
- Limits file size for inclusion to prevent oversized outputs
- Can be installed globally for easy access from any directory

## Installation

### Global Installation from npm (once published)

You can install CodeWise globally using npm:

```bash
npm install -g codewise
```

### Local Development Installation

For development or testing before publishing:

1. Clone the repository:
   ```bash
   git clone https://github.com/omarbadran/codewise.git
   cd codewise
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Link the package globally:
   ```bash
   npm link
   ```

Now you can use `codewise` command globally, but it will use your local development version.

## Usage

After installing globally or linking, you can run CodeWise from any directory:

```bash
codewise [options]
```

If installed locally in a project, you can use it via npx:

```bash
npx codewise [options]
```

### Options

- `-c, --config <path>`: Path to configuration file (default: `codewise.json`)
- `-o, --output <path>`: Output file path (default: `codewise-output.md`)
- `-f, --format <format>`: Output format (`xml` or `markdown`, default: `markdown`)
- `-s, --max-size <size>`: Maximum file size in KB (default: 100)
- `-i, --include <patterns...>`: Include glob patterns
- `-e, --exclude <patterns...>`: Exclude glob patterns

### Configuration

You can configure CodeWise using a `codewise.json` file in your project root. Example:

```json
{
  "include": ["**/*"],
  "exclude": ["node_modules/**", ".git/**", "dist/**"],
  "maxFileSize": 102400,
  "outputFormat": "markdown"
}
```

- `include`: Glob patterns for files to include
- `exclude`: Glob patterns for files to exclude
- `maxFileSize`: Maximum file size in bytes to include
- `outputFormat`: Output format (`xml` or `markdown`)

Command-line options will override the configuration file settings.

## Output

CodeWise generates a file containing:

1. A full file tree of your project
2. A tree of included files
3. The content of included files, formatted as specified

This output can be easily copied and pasted into your conversations with LLMs to provide context about your codebase.

## Example

Running CodeWise in a project directory:

```bash
codewise -o my-project-context.md -f markdown -s 200
```

This command will:
- Generate the context in Markdown format
- Save the output to `my-project-context.md`
- Include files up to 200 KB in size

## Development

To set up the project for development, follow the "Local Development Installation" steps in the Installation section.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

CodeWise was created by Omar Badran (engineer.o.badran@gmail.com). 

Special thanks to the Anthropic's `Claude 3.5 Sonnet` model for providing valuable insights and assistance during the development process.