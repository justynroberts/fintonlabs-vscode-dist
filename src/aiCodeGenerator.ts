import * as vscode from 'vscode';
import * as path from 'path';
import axios from 'axios';
import OpenAI from 'openai';
import { FileSystemService } from './fileSystemService';

/**
 * Service responsible for generating code using AI models
 */
export class AICodeGeneratorService {
    private _context: vscode.ExtensionContext;
    private _fileSystemService: FileSystemService;
    private _openai: OpenAI | null = null;
    
    constructor(context: vscode.ExtensionContext, fileSystemService: FileSystemService) {
        this._context = context;
        this._fileSystemService = fileSystemService;
        this._initializeAIClient();
        
        // Listen for configuration changes to reinitialize the AI client
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('fintonlabs')) {
                this._initializeAIClient();
            }
        });
    }
    
    /**
     * Initializes the AI client based on configuration
     */
    private _initializeAIClient() {
        const config = vscode.workspace.getConfiguration('fintonlabs');
        const apiKey = config.get<string>('apiKey');
        
        if (apiKey) {
            this._openai = new OpenAI({ apiKey });
        } else {
            this._openai = null;
        }
    }
    
    /**
     * Checks if the API key is configured
     */
    private _checkApiKey(): boolean {
        if (!this._openai) {
            vscode.window.showErrorMessage(
                'API key not configured. Please set your API key in the extension settings.',
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand(
                        'workbench.action.openSettings',
                        'fintonlabs.apiKey'
                    );
                }
            });
            return false;
        }
        return true;
    }
    
    /**
     * Generates a complete application based on a description
     */
    public async generateApplication(description: string, projectPath: string, framework: string = 'react'): Promise<GenerationResult> {
        if (!this._checkApiKey()) {
            throw new Error('API key not configured');
        }
        
        try {
            // Generate project structure with AI
            const projectStructure = await this._generateProjectStructure(description, framework);
            
            // Create output directory if it doesn't exist
            await this._fileSystemService.ensureDirectory(projectPath);
            
            // Create all files in the project structure
            const createdFiles = [];
            for (const file of projectStructure.files) {
                const filePath = path.join(projectPath, file.path);
                await this._fileSystemService.createFile(filePath, file.content);
                createdFiles.push(filePath);
            }
            
            return {
                message: `Application generated successfully with ${createdFiles.length} files`,
                files: createdFiles
            };
        } catch (error) {
            console.error('Error generating application:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate application: ${errorMessage}`);
        }
    }
    
    /**
     * Updates an existing application based on new requirements
     */
    public async updateApplication(projectPath: string, newRequirements: string): Promise<GenerationResult> {
        if (!this._checkApiKey()) {
            throw new Error('API key not configured');
        }
        
        try {
            // Scan existing project to understand its structure
            const projectAnalysis = await this._analyzeExistingProject(projectPath);
            
            // Generate update plan with AI
            const updatePlan = await this._generateUpdatePlan(projectAnalysis, newRequirements);
            
            // Apply updates
            const updatedFiles = [];
            for (const file of updatePlan.files) {
                const filePath = path.join(projectPath, file.path);
                
                if (file.action === 'create') {
                    await this._fileSystemService.createFile(filePath, file.content || '');
                } else if (file.action === 'update') {
                    await this._fileSystemService.updateFile(filePath, file.content || '');
                } else if (file.action === 'delete') {
                    await this._fileSystemService.deleteFile(filePath);
                }
                
                updatedFiles.push(filePath);
            }
            
            return {
                message: `Application updated successfully with ${updatedFiles.length} files modified`,
                files: updatedFiles
            };
        } catch (error) {
            console.error('Error updating application:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update application: ${errorMessage}`);
        }
    }
    
    /**
     * Generates a component based on a description
     */
    public async generateComponent(description: string, targetPath: string): Promise<ComponentGenerationResult> {
        if (!this._checkApiKey()) {
            throw new Error('API key not configured');
        }
        
        try {
            // Determine component type from file extension or path
            const fileExt = path.extname(targetPath);
            let language = 'javascript';
            let framework = 'react';
            
            if (fileExt === '.vue') {
                framework = 'vue';
            } else if (fileExt === '.svelte') {
                framework = 'svelte';
            } else if (targetPath.includes('angular')) {
                framework = 'angular';
            }
            
            if (['.ts', '.tsx'].includes(fileExt)) {
                language = 'typescript';
            }
            
            // Generate component code with AI
            const componentCode = await this._generateComponentCode(description, framework, language);
            
            // Create the component file
            await this._fileSystemService.createFile(targetPath, componentCode);
            
            return {
                filePath: targetPath,
                code: componentCode
            };
        } catch (error) {
            console.error('Error generating component:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate component: ${errorMessage}`);
        }
    }
    
    /**
     * Generates a function based on a description
     */
    public async generateFunction(description: string, language: string): Promise<FunctionGenerationResult> {
        if (!this._checkApiKey()) {
            throw new Error('API key not configured');
        }
        
        try {
            // Map VS Code language ID to language name
            const languageMap: Record<string, string> = {
                'javascript': 'javascript',
                'typescript': 'typescript',
                'javascriptreact': 'javascript',
                'typescriptreact': 'typescript',
                'python': 'python',
                'java': 'java',
                'csharp': 'c#',
                'go': 'go',
                'rust': 'rust'
            };
            
            const mappedLanguage = languageMap[language] || language;
            
            // Generate function code with AI
            const functionCode = await this._generateFunctionCode(description, mappedLanguage);
            
            return {
                code: functionCode
            };
        } catch (error) {
            console.error('Error generating function:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to generate function: ${errorMessage}`);
        }
    }
    
    /**
     * Generates a complete project structure using AI
     */
    private async _generateProjectStructure(description: string, framework: string): Promise<ProjectStructure> {
        // Get token count estimate for the prompt
        const frameworkDetails = this._getFrameworkDetails(framework);
        const estimatedTokens = description.length / 4 + 1000; // Very rough estimate
        
        if (estimatedTokens > 2000) {
            // Use the chunked approach for larger projects
            return this._generateLargerProject(description, framework);
        } else {
            // Use the original approach for smaller projects
            const config = vscode.workspace.getConfiguration('fintonlabs');
            const model = config.get<string>('model') || 'gpt-4';
            const maxTokens = config.get<number>('maxTokens') || 4096;
            
            const prompt = `
            Generate a complete ${frameworkDetails.name} application based on the following description:
            
            ${description}
            
            Create a full project structure with all necessary files. For each file, include the relative file path and the complete content.
            
            Programming language: ${frameworkDetails.language}
            Framework: ${frameworkDetails.name}
            Type: ${frameworkDetails.type}
            Key dependencies: ${frameworkDetails.dependencies.join(', ')}
            
            Respond with a valid JSON object that matches this structure:
            {
                "files": [
                    {
                        "path": "relative/path/to/file.ext",
                        "content": "complete file content"
                    }
                    // more files...
                ]
            }
            
            Include all necessary configurations, dependencies, and files to make the project work. Focus on creating a functional, well-structured application following best practices for ${frameworkDetails.name} development.
            `;
            
            try {
                if (this._openai) {
                    const completion = await this._openai.chat.completions.create({
                        model: model === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                        max_tokens: maxTokens
                    });
                    
                    const responseContent = completion.choices[0].message.content;
                    if (responseContent) {
                        try {
                            // Extract JSON from the response
                            const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || 
                                            responseContent.match(/```\n([\s\S]*?)\n```/) || 
                                            [null, responseContent];
                            
                            const jsonContent = jsonMatch[1] ? jsonMatch[1].trim() : responseContent.trim();
                            return JSON.parse(jsonContent);
                        } catch (parseError) {
                            console.error('Error parsing AI response:', parseError);
                            throw new Error('Failed to parse AI response. The response was not valid JSON.');
                        }
                    }
                }
                
                throw new Error('Failed to generate project structure. API not initialized.');
            } catch (error) {
                console.error('Error calling AI API:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Error calling AI API: ${errorMessage}`);
            }
        }
    }
    
    /**
     * Analyzes an existing project to understand its structure
     */
    private async _analyzeExistingProject(projectPath: string): Promise<ProjectAnalysis> {
        try {
            // Scan for key files
            const packageJsonPath = path.join(projectPath, 'package.json');
            const hasPackageJson = await this._fileSystemService.fileExists(packageJsonPath);
            
            let packageJson = null;
            if (hasPackageJson) {
                const packageJsonContent = await this._fileSystemService.readFile(packageJsonPath);
                packageJson = JSON.parse(packageJsonContent);
            }
            
            // Detect project type and framework
            let projectType = 'unknown';
            let framework = 'unknown';
            
            if (packageJson) {
                const dependencies = {
                    ...packageJson.dependencies,
                    ...packageJson.devDependencies
                };
                
                if (dependencies.react) {
                    framework = 'react';
                    projectType = 'frontend';
                } else if (dependencies.vue) {
                    framework = 'vue';
                    projectType = 'frontend';
                } else if (dependencies.angular) {
                    framework = 'angular';
                    projectType = 'frontend';
                } else if (dependencies.express || dependencies.koa || dependencies['@nestjs/core']) {
                    framework = dependencies.express ? 'express' : dependencies.koa ? 'koa' : 'nest';
                    projectType = 'backend';
                }
            }
            
            // Scan for important files to include in analysis
            const filesToAnalyze = [
                'package.json',
                'tsconfig.json',
                'src/index.js',
                'src/index.ts',
                'src/App.js',
                'src/App.tsx',
                'src/main.js',
                'src/main.ts'
            ];
            
            const fileContents: Record<string, string> = {};
            
            for (const file of filesToAnalyze) {
                const filePath = path.join(projectPath, file);
                if (await this._fileSystemService.fileExists(filePath)) {
                    fileContents[file] = await this._fileSystemService.readFile(filePath);
                }
            }
            
            // Get directory structure
            const directoryStructure = await this._scanDirectory(projectPath);
            
            return {
                projectType,
                framework,
                packageJson,
                fileContents,
                directoryStructure
            };
        } catch (error) {
            console.error('Error analyzing existing project:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to analyze existing project: ${errorMessage}`);
        }
    }
    
    /**
     * Scans a directory and returns its structure
     */
    private async _scanDirectory(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): Promise<string[]> {
        if (currentDepth >= maxDepth) {
            return [];
        }
        
        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            let files: string[] = [];
            
            for (const [name, type] of entries) {
                const fullPath = path.join(dirPath, name);
                const relativePath = path.relative(dirPath, fullPath);
                
                // Skip node_modules and other large generated directories
                if (['node_modules', 'dist', 'build', '.git'].includes(name)) {
                    continue;
                }
                
                if (type === vscode.FileType.Directory) {
                    files.push(`${relativePath}/`);
                    const subDirFiles = await this._scanDirectory(fullPath, maxDepth, currentDepth + 1);
                    files = files.concat(subDirFiles.map(f => path.join(relativePath, f)));
                } else {
                    files.push(relativePath);
                }
            }
            
            return files;
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error);
            return [];
        }
    }
    
    /**
     * Generates an update plan for an existing project
     */
    private async _generateUpdatePlan(projectAnalysis: ProjectAnalysis, newRequirements: string): Promise<UpdatePlan> {
        const config = vscode.workspace.getConfiguration('fintonlabs');
        const model = config.get<string>('model') || 'gpt-4';
        const maxTokens = config.get<number>('maxTokens') || 4096;
        
        // Prepare project analysis for prompt
        const analysisJson = JSON.stringify({
            projectType: projectAnalysis.projectType,
            framework: projectAnalysis.framework,
            packageJson: projectAnalysis.packageJson,
            fileContents: projectAnalysis.fileContents,
            directoryStructure: projectAnalysis.directoryStructure
        }, null, 2);
        
        const prompt = `
        Analyze this existing project structure:
        
        ${analysisJson}
        
        I need to update the project to implement these new requirements:
        
        ${newRequirements}
        
        Generate an update plan that creates, modifies, or deletes files to implement these requirements.
        Respond with a valid JSON object that matches this structure:
        {
            "files": [
                {
                    "path": "relative/path/to/file.ext",
                    "action": "create" | "update" | "delete",
                    "content": "complete file content" // only for create or update
                }
                // more files...
            ]
        }
        
        Focus on creating a minimal set of changes that will successfully implement the requirements.
        `;
        
        try {
            if (this._openai) {
                const completion = await this._openai.chat.completions.create({
                    model: model === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: maxTokens
                });
                
                const responseContent = completion.choices[0].message.content;
                if (responseContent) {
                    try {
                        // Extract JSON from the response
                        const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || 
                                        responseContent.match(/```\n([\s\S]*?)\n```/) || 
                                        [null, responseContent];
                        
                        const jsonContent = jsonMatch[1] ? jsonMatch[1].trim() : responseContent.trim();
                        return JSON.parse(jsonContent);
                    } catch (parseError) {
                        console.error('Error parsing AI response:', parseError);
                        throw new Error('Failed to parse AI response. The response was not valid JSON.');
                    }
                }
            }
            
            throw new Error('Failed to generate update plan. API not initialized.');
        } catch (error) {
            console.error('Error calling AI API:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Error calling AI API: ${errorMessage}`);
        }
    }
    
    /**
     * Generates component code using AI
     */
    private async _generateComponentCode(description: string, framework: string, language: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('fintonlabs');
        const model = config.get<string>('model') || 'gpt-4';
        const maxTokens = config.get<number>('maxTokens') || 4096;
        
        const prompt = `
        Generate a ${framework} component based on this description:
        
        ${description}
        
        The component should be implemented in ${language}.
        
        Create a complete, working component with all necessary imports, props, state, and handlers.
        Include comprehensive comments to explain the implementation.
        `;
        
        try {
            if (this._openai) {
                const completion = await this._openai.chat.completions.create({
                    model: model === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: maxTokens
                });
                
                const responseContent = completion.choices[0].message.content;
                if (responseContent) {
                    // Extract code from the response
                    const codeMatch = responseContent.match(/```(?:\w+)?\n([\s\S]*?)\n```/) || [null, responseContent];
                    return codeMatch[1] ? codeMatch[1].trim() : responseContent.trim();
                }
            }
            
            throw new Error('Failed to generate component code. API not initialized.');
        } catch (error) {
            console.error('Error calling AI API:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Error calling AI API: ${errorMessage}`);
        }
    }
    
    /**
     * Generates function code using AI
     */
    private async _generateFunctionCode(description: string, language: string): Promise<string> {
        const config = vscode.workspace.getConfiguration('fintonlabs');
        const model = config.get<string>('model') || 'gpt-4';
        const maxTokens = config.get<number>('maxTokens') || 4096;
        
        const prompt = `
        Generate a function in ${language} based on this description:
        
        ${description}
        
        Create a complete, well-documented function with proper error handling and edge case coverage.
        Include comprehensive comments to explain the implementation.
        `;
        
        try {
            if (this._openai) {
                const completion = await this._openai.chat.completions.create({
                    model: model === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: maxTokens
                });
                
                const responseContent = completion.choices[0].message.content;
                if (responseContent) {
                    // Extract code from the response
                    const codeMatch = responseContent.match(/```(?:\w+)?\n([\s\S]*?)\n```/) || [null, responseContent];
                    return codeMatch[1] ? codeMatch[1].trim() : responseContent.trim();
                }
            }
            
            throw new Error('Failed to generate function code. API not initialized.');
        } catch (error) {
            console.error('Error calling AI API:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Error calling AI API: ${errorMessage}`);
        }
    }

    /**
     * Get framework details based on framework ID
     */
    private _getFrameworkDetails(framework: string): FrameworkInfo {
        const frameworks: Record<string, FrameworkInfo> = {
            // JavaScript/TypeScript
            'react': {
                name: 'React',
                language: 'JavaScript/TypeScript',
                type: 'frontend',
                dependencies: ['react', 'react-dom', 'react-scripts']
            },
            'vue': {
                name: 'Vue.js',
                language: 'JavaScript/TypeScript',
                type: 'frontend',
                dependencies: ['vue', 'vue-router', 'vuex']
            },
            'angular': {
                name: 'Angular',
                language: 'TypeScript',
                type: 'frontend',
                dependencies: ['@angular/core', '@angular/common', '@angular/router']
            },
            'express': {
                name: 'Express.js',
                language: 'JavaScript/TypeScript',
                type: 'backend',
                dependencies: ['express', 'body-parser', 'mongoose']
            },
            'next': {
                name: 'Next.js',
                language: 'JavaScript/TypeScript',
                type: 'fullstack',
                dependencies: ['next', 'react', 'react-dom']
            },
            
            // Python
            'fastapi': {
                name: 'FastAPI',
                language: 'Python',
                type: 'backend',
                dependencies: ['fastapi', 'uvicorn', 'pydantic']
            },
            'django': {
                name: 'Django',
                language: 'Python',
                type: 'fullstack',
                dependencies: ['django', 'djangorestframework', 'django-cors-headers']
            },
            'flask': {
                name: 'Flask',
                language: 'Python',
                type: 'backend',
                dependencies: ['flask', 'flask-sqlalchemy', 'flask-migrate']
            },
            
            // Java
            'spring': {
                name: 'Spring Boot',
                language: 'Java',
                type: 'backend',
                dependencies: ['spring-boot-starter-web', 'spring-boot-starter-data-jpa', 'spring-boot-starter-security']
            },
            'android': {
                name: 'Android App',
                language: 'Java/Kotlin',
                type: 'mobile',
                dependencies: ['androidx.core:core-ktx', 'androidx.appcompat:appcompat', 'com.google.android.material:material']
            },
            
            // C#
            'aspnet': {
                name: 'ASP.NET Core',
                language: 'C#',
                type: 'backend',
                dependencies: ['Microsoft.AspNetCore.App', 'Microsoft.EntityFrameworkCore', 'Newtonsoft.Json']
            },
            'wpf': {
                name: 'WPF Desktop App',
                language: 'C#',
                type: 'desktop',
                dependencies: ['Microsoft.Extensions.DependencyInjection', 'MaterialDesignThemes']
            },
            
            // Go
            'golang-web': {
                name: 'Go Web Server',
                language: 'Go',
                type: 'backend',
                dependencies: ['github.com/gin-gonic/gin', 'github.com/go-sql-driver/mysql', 'github.com/golang-jwt/jwt']
            },
            'golang-cli': {
                name: 'Go CLI Application',
                language: 'Go',
                type: 'cli',
                dependencies: ['github.com/spf13/cobra', 'github.com/spf13/viper', 'github.com/sirupsen/logrus']
            },
            
            // Ruby
            'rails': {
                name: 'Ruby on Rails',
                language: 'Ruby',
                type: 'fullstack',
                dependencies: ['rails', 'pg', 'devise']
            },
            
            // PHP
            'laravel': {
                name: 'Laravel',
                language: 'PHP',
                type: 'fullstack',
                dependencies: ['laravel/framework', 'laravel/sanctum', 'laravel/tinker']
            },
            
            // Rust
            'rust-web': {
                name: 'Rust Web Service',
                language: 'Rust',
                type: 'backend',
                dependencies: ['actix-web', 'tokio', 'serde']
            },
            'rust-cli': {
                name: 'Rust CLI Tool',
                language: 'Rust',
                type: 'cli',
                dependencies: ['clap', 'serde', 'tokio']
            }
        };
        
        return frameworks[framework] || {
            name: framework,
            language: 'Unknown',
            type: 'unknown',
            dependencies: []
        };
    }

    /**
     * Method to split large prompts into manageable chunks
     */
    private async _generateLargerProject(description: string, framework: string): Promise<ProjectStructure> {
        // First, determine the project structure without full file content
        const structurePrompt = `
        Based on this description: "${description}"
        
        Generate a structure for a ${framework} application.
        Return ONLY a JSON array of file paths that would be included in this project.
        Example: ["package.json", "src/index.js", "src/components/App.js"]
        
        Do not include file content, just the paths.
        `;
        
        // Get the structure first
        const structureResponse = await this._callAI(structurePrompt, 2048);
        let filePaths: string[] = [];
        
        try {
            // Parse the response to get file paths
            const pathMatch = structureResponse.match(/\[([\s\S]*?)\]/);
            if (pathMatch) {
                const pathJson = `[${pathMatch[1]}]`;
                filePaths = JSON.parse(pathJson);
            }
        } catch (error) {
            console.error('Error parsing structure response:', error);
            throw new Error('Failed to generate project structure');
        }
        
        // Now generate content for each file separately
        const files: {path: string, content: string}[] = [];
        const frameworkDetails = this._getFrameworkDetails(framework);
        
        for (const filePath of filePaths) {
            const filePrompt = `
            Generate code for a ${filePath} file in a ${frameworkDetails.name} project.
            
            Project description: ${description}
            
            I need the complete content for this specific file. Focus only on this file.
            Context: This is part of a ${frameworkDetails.name} application written in ${frameworkDetails.language}.
            `;
            
            try {
                const fileContent = await this._callAI(filePrompt, 2048);
                
                // Clean up the response to extract just the code
                const codeMatch = fileContent.match(/```(?:\w+)?\n([\s\S]*?)\n```/) || [null, fileContent];
                const cleanedContent = codeMatch[1] ? codeMatch[1].trim() : fileContent.trim();
                
                files.push({
                    path: filePath,
                    content: cleanedContent
                });
            } catch (error) {
                console.error(`Error generating content for ${filePath}:`, error);
                files.push({
                    path: filePath,
                    content: `// Failed to generate content for this file: ${error}`
                });
            }
        }
        
        return { files };
    }

    /**
     * Helper method for AI calls
     */
    private async _callAI(prompt: string, maxTokens: number): Promise<string> {
        const config = vscode.workspace.getConfiguration('fintonlabs');
        const model = config.get<string>('model') || 'gpt-4';
        
        try {
            if (this._openai) {
                const completion = await this._openai.chat.completions.create({
                    model: model === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.7,
                    max_tokens: maxTokens
                });
                
                return completion.choices[0].message.content || '';
            }
            
            throw new Error('OpenAI client not initialized');
        } catch (error) {
            console.error('Error calling AI API:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Error calling AI API: ${errorMessage}`);
        }
    }
}

// Types
export interface GenerationResult {
    message: string;
    files: string[];
}

export interface ComponentGenerationResult {
    filePath: string;
    code: string;
}

export interface FunctionGenerationResult {
    code: string;
}

export interface ProjectStructure {
    files: {
        path: string;
        content: string;
    }[];
}

export interface ProjectAnalysis {
    projectType: string;
    framework: string;
    packageJson: any;
    fileContents: Record<string, string>;
    directoryStructure: string[];
}

export interface UpdatePlan {
    files: {
        path: string;
        action: 'create' | 'update' | 'delete';
        content?: string;
    }[];
}

interface FrameworkInfo {
    name: string;
    language: string;
    type: string;
    dependencies: string[];
}