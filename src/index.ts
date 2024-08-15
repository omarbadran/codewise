#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { program } from 'commander';
import ignore, { Ignore } from 'ignore';
import { glob } from 'glob';
import readline from 'readline';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.simple(),
    transports: [
        new winston.transports.Console(),
    ],
});

enum OutputFormat {
    XML = 'xml',
    Markdown = 'markdown'
}

interface Config {
    include: string[];
    exclude: string[];
    maxFileSize: number;
    outputFormat: OutputFormat;
}

const DEFAULT_CONFIG: Config = {
    include: ['**/*'],
    exclude: ['node_modules/**', '.git/**', 'package-lock.json', 'yarn.lock'],
    maxFileSize: 100 * 1024, // 100 KB
    outputFormat: OutputFormat.Markdown
};

async function loadConfig(configPath: string): Promise<Config> {
    try {
        if (fs.existsSync(configPath)) {
            const configFile = await fs.promises.readFile(configPath, 'utf8');
            const loadedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(configFile) };
            logger.info('Loaded config:', loadedConfig);
            return loadedConfig;
        }
    } catch (error) {
        logger.error(`Error loading config from ${configPath}:`, error);
    }
    return DEFAULT_CONFIG;
}

function createIgnore(config: Config, outputFile: string): Ignore {
    const ig = ignore().add([...config.exclude, outputFile]);
    if (fs.existsSync('.gitignore')) {
        ig.add(fs.readFileSync('.gitignore', 'utf8'));
    }
    return ig;
}

function generateFullFileTree(dir: string, ig: Ignore, prefix = ''): string {
    let tree = '';
    const files = fs.readdirSync(dir);
    files.forEach((file, index) => {
        const filePath = path.join(dir, file);
        const relativePath = path.relative(process.cwd(), filePath);
        const isLast = index === files.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const isIgnored = ig.ignores(relativePath);

        tree += `${prefix}${connector}${file}\n`;

        if (fs.statSync(filePath).isDirectory()) {
            if (file === 'node_modules' || file === '.git') {
                tree += `${prefix}${isLast ? '    ' : '│   '}└── ...\n`;
            } else if (!isIgnored) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                tree += generateFullFileTree(filePath, ig, newPrefix);
            }
        }
    });
    return tree;
}

async function getIncludedFiles(dir: string, config: Config, ig: Ignore): Promise<string[]> {
    const globPattern = config.include.length > 0 ? config.include : ['**/*'];
    const globOptions = {
        cwd: dir,
        nodir: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**', ...config.exclude]
    };
    const allFiles = await glob(globPattern, globOptions);
    const includedFiles = allFiles.filter(file => {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        const isIncluded = !ig.ignores(file) && stats.size <= config.maxFileSize;
        return isIncluded;
    });
    return includedFiles;
}

function formatIncludedFiles(files: string[]): string {
    const fileTree: { [key: string]: any } = {};
    
    files.forEach(filePath => {
        const pathParts = filePath.split(path.sep);
        let currentNode = fileTree;
        pathParts.forEach((part, index) => {
            if (index === pathParts.length - 1) {
                if (!currentNode[part]) {
                    currentNode[part] = null;
                }
            } else {
                if (!currentNode[part]) {
                    currentNode[part] = {};
                }
                currentNode = currentNode[part];
            }
        });
    });

    function renderTree(node: any, prefix = ''): string {
        let result = '';
        const entries = Object.entries(node);
        entries.forEach(([key, value], index) => {
            const isLast = index === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            result += `${prefix}${connector}${key}\n`;
            if (value !== null) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                result += renderTree(value, newPrefix);
            }
        });
        return result;
    }

    return renderTree(fileTree);
}

function getFileContent(filePath: string, config: Config): string {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(process.cwd(), filePath);
        if (config.outputFormat === OutputFormat.XML) {
            return `<file path="${relativePath}">\n<![CDATA[\n${content}\n]]>\n</file>\n\n`;
        } else {
            return `\`\`\`${relativePath}\n${content}\n\`\`\`\n\n`;
        }
    } catch (error) {
        logger.error(`Error reading file ${filePath}:`, error);
        return `Error reading file ${filePath}: ${(error as Error).message}\n\n`;
    }
}

async function generateCodeContext(dir: string, config: Config, ig: Ignore): Promise<string> {
    let context = 'Full File Tree:\n\n';
    context += generateFullFileTree(dir, ig);
    context += '\nIncluded Files:\n\n';
    const includedFiles = await getIncludedFiles(dir, config, ig);
    context += formatIncludedFiles(includedFiles);
    context += '\nCode Context:\n\n';

    for (const filePath of includedFiles) {
        context += getFileContent(path.join(dir, filePath), config);
    }

    return context;
}

function writeToFile(content: string, outputPath: string): void {
    try {
        fs.writeFileSync(outputPath, content);
        logger.info(`Content written to ${outputPath}`);
    } catch (error) {
        logger.error(`Error writing to file ${outputPath}:`, error);
    }
}

async function promptUser(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function main() {
    program
        .version('1.0.0')
        .description('Generate codebase context for LLMs')
        .option('-c, --config <path>', 'Path to configuration file', 'codewise.json')
        .option('-o, --output <path>', 'Output file path', 'codewise-output.md')
        .option('-f, --format <format>', 'Output format (xml or markdown)', 'markdown')
        .option('-s, --max-size <size>', 'Maximum file size in KB', '100')
        .option('-i, --include <patterns...>', 'Include glob patterns')
        .option('-e, --exclude <patterns...>', 'Exclude glob patterns')
        .parse(process.argv);

    const options = program.opts();
    const config = await loadConfig(options.config);

    if (options.format) {
        config.outputFormat = options.format as OutputFormat;
    }
    if (options.maxSize) {
        config.maxFileSize = parseInt(options.maxSize) * 1024;
    }
    if (options.include) {
        config.include = options.include;
    }
    if (options.exclude) {
        config.exclude = [...config.exclude, ...options.exclude];
    }

    const ig = createIgnore(config, options.output);
    const includedFiles = await getIncludedFiles(process.cwd(), config, ig);
    
    logger.info('Files to be included:');
    logger.info('\n' + formatIncludedFiles(includedFiles));

    const proceed = await promptUser('Do you want to proceed with the context generation? (y/n): ');
    
    if (proceed) {
        logger.info('Generating code context...');
        const codeContext = await generateCodeContext(process.cwd(), config, ig);
        writeToFile(codeContext, options.output);
        logger.info('Content generated. You can find it in the output file.');
    } else {
        logger.info('Context generation aborted.');
    }
}

main().catch(error => {
    logger.error('An error occurred:', error);
    process.exit(1);
});