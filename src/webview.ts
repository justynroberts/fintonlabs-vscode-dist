import * as vscode from 'vscode';
import * as path from 'path';
import { AICodeGeneratorService } from './aiCodeGenerator';

/**
 * Manages WebView panels for Fintonlabs code generation
 */
export class CodeGeneratorPanel {
    public static currentPanel: CodeGeneratorPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _aiCodeGenerator: AICodeGeneratorService;
    private _mode: 'create' | 'update';

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        aiCodeGenerator: AICodeGeneratorService,
        mode: 'create' | 'update'
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._aiCodeGenerator = aiCodeGenerator;
        this._mode = mode;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'generateApp':
                        await this._generateApplication(message.description, message.location, message.framework);
                        return;
                    case 'updateApp':
                        await this._updateApplication(message.location, message.requirements);
                        return;
                    case 'browse':
                        this._browseForFolder();
                        return;
                    case 'cancel':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    /**
     * Creates a new panel for code generation
     */
    public static createOrShow(
        extensionUri: vscode.Uri,
        aiCodeGenerator: AICodeGeneratorService,
        mode: 'create' | 'update' = 'create'
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (CodeGeneratorPanel.currentPanel) {
            CodeGeneratorPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'fintonlabs',
            mode === 'create' ? 'Fintonlabs: Create Application' : 'Fintonlabs: Update Application',
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
                // Restrict the webview to only load resources from our extension's directory
                localResourceRoots: [extensionUri]
            }
        );

        CodeGeneratorPanel.currentPanel = new CodeGeneratorPanel(
            panel,
            extensionUri,
            aiCodeGenerator,
            mode
        );
    }

    /**
     * Closes the panel
     */
    public dispose() {
        CodeGeneratorPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    /**
     * Updates the webview content
     */
    private _update() {
        const webview = this._panel.webview;
        this._panel.title = this._mode === 'create' 
            ? 'Fintonlabs: Create Application' 
            : 'Fintonlabs: Update Application';
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    /**
     * Handles application generation
     */
    private async _generateApplication(description: string, location: string, framework: string) {
        if (!description || !location) {
            this._panel.webview.postMessage({
                command: 'error',
                text: 'Please provide both a description and location'
            });
            return;
        }

        this._panel.webview.postMessage({ command: 'startGeneration' });

        try {
            const result = await this._aiCodeGenerator.generateApplication(description, location, framework);
            
            this._panel.webview.postMessage({ 
                command: 'generationComplete',
                result
            });
            
            vscode.window.showInformationMessage(result.message);
            
            // Open the project in a new window
            const openInNewWindow = await vscode.window.showInformationMessage(
                'Application generated successfully. Would you like to open it in a new window?',
                'Yes', 'No'
            );
            
            if (openInNewWindow === 'Yes') {
                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(location), true);
            }
            
            this.dispose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._panel.webview.postMessage({ 
                command: 'error',
                text: `Error generating application: ${errorMessage}`
            });
        }
    }

    /**
     * Handles application update
     */
    private async _updateApplication(location: string, requirements: string) {
        if (!requirements || !location) {
            this._panel.webview.postMessage({
                command: 'error',
                text: 'Please provide both new requirements and project location'
            });
            return;
        }

        this._panel.webview.postMessage({ command: 'startUpdate' });

        try {
            const result = await this._aiCodeGenerator.updateApplication(location, requirements);
            
            this._panel.webview.postMessage({ 
                command: 'updateComplete',
                result
            });
            
            vscode.window.showInformationMessage(result.message);
            this.dispose();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this._panel.webview.postMessage({ 
                command: 'error',
                text: `Error updating application: ${errorMessage}`
            });
        }
    }

    /**
     * Opens a folder browser dialog
     */
    private async _browseForFolder() {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: this._mode === 'create' ? 'Select Output Folder' : 'Select Project Folder'
        };

        const result = await vscode.window.showOpenDialog(options);
        if (result && result.length > 0) {
            const folderPath = result[0].fsPath;
            this._panel.webview.postMessage({
                command: 'setLocation',
                location: folderPath
            });
        }
    }

    /**
     * Gets the HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to script and css resources
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );
        const logoUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'fintonlabs-logo.svg')
        );

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        const isCreateMode = this._mode === 'create';

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
            <link href="${styleUri}" rel="stylesheet">
            <title>${isCreateMode ? 'Create Application' : 'Update Application'}</title>
            <style>
                .language-icon {
                    width: 16px;
                    height: 16px;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                
                .language-label {
                    display: flex;
                    align-items: center;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img class="logo" src="${logoUri}" alt="Fintonlabs Logo" />
                    <h1>${isCreateMode ? 'Generate New Application' : 'Update Existing Application'}</h1>
                </div>
                
                <div class="card">
                    <div class="form-group">
                        <label for="description">${isCreateMode ? 'Application Description:' : 'New Requirements:'}</label>
                        <textarea id="description" class="form-control" rows="6" placeholder="${
                            isCreateMode 
                            ? 'Describe the application you want to create in detail...' 
                            : 'Describe the new features or changes you want to make...'
                        }"></textarea>
                    </div>
                    
                    ${isCreateMode ? `
                    <div class="form-group">
                        <label for="framework">Template:</label>
                        <div class="select-wrapper">
                            <select id="framework" class="form-control">
                                <optgroup label="JavaScript/TypeScript">
                                    <option value="react">React</option>
                                    <option value="vue">Vue</option>
                                    <option value="angular">Angular</option>
                                    <option value="express">Express (Node.js)</option>
                                    <option value="next">Next.js</option>
                                </optgroup>
                                <optgroup label="Python">
                                    <option value="python-native">Native Python</option>
                                    <option value="fastapi">FastAPI</option>
                                    <option value="django">Django</option>
                                    <option value="flask">Flask</option>
                                </optgroup>
                                <optgroup label="Infrastructure as Code">
                                    <option value="terraform">Terraform</option>
                                    <option value="ansible">Ansible</option>
                                </optgroup>
                                <optgroup label="Database">
                                    <option value="sql-mysql">MySQL</option>
                                    <option value="sql-postgres">PostgreSQL</option>
                                    <option value="sql-sqlite">SQLite</option>
                                </optgroup>
                                <optgroup label="Shell">
                                    <option value="bash">Bash Script</option>
                                </optgroup>
                                <optgroup label="Java">
                                    <option value="spring">Spring Boot</option>
                                    <option value="android">Android App</option>
                                </optgroup>
                                <optgroup label="C#">
                                    <option value="aspnet">ASP.NET Core</option>
                                    <option value="wpf">WPF Desktop App</option>
                                </optgroup>
                                <optgroup label="Go">
                                    <option value="golang-web">Go Web Server</option>
                                    <option value="golang-cli">Go CLI Application</option>
                                </optgroup>
                                <optgroup label="Ruby">
                                    <option value="rails">Ruby on Rails</option>
                                </optgroup>
                                <optgroup label="PHP">
                                    <option value="laravel">Laravel</option>
                                </optgroup>
                                <optgroup label="Rust">
                                    <option value="rust-web">Rust Web Service</option>
                                    <option value="rust-cli">Rust CLI Tool</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label for="location">${isCreateMode ? 'Output Location:' : 'Project Location:'}</label>
                        <div class="location-picker">
                            <input type="text" id="location" class="form-control" readonly placeholder="${
                                isCreateMode 
                                ? 'Select where to create the application...' 
                                : 'Select the project to update...'
                            }">
                            <button id="browse" class="btn btn-secondary">Browse...</button>
                        </div>
                    </div>
                    
                    <div id="progress" class="progress-container" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                        <div class="progress-text">Processing... This may take a few minutes.</div>
                    </div>
                    
                    <div class="form-actions">
                        <button id="generateBtn" class="btn btn-primary">${isCreateMode ? 'Generate Application' : 'Update Application'}</button>
                        <button id="cancelBtn" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
            
            <script nonce="${nonce}">
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // DOM Elements
                    const descriptionInput = document.getElementById('description');
                    ${isCreateMode ? 'const frameworkSelect = document.getElementById("framework");' : ''}
                    const locationInput = document.getElementById('location');
                    const browseButton = document.getElementById('browse');
                    const generateBtn = document.getElementById('generateBtn');
                    const cancelBtn = document.getElementById('cancelBtn');
                    const progressContainer = document.getElementById('progress');
                    
                    // Initialize state from stored state
                    const previousState = vscode.getState() || {};
                    if (previousState.description) {
                        descriptionInput.value = previousState.description;
                    }
                    ${isCreateMode ? `
                    if (previousState.framework) {
                        frameworkSelect.value = previousState.framework;
                    }
                    ` : ''}
                    if (previousState.location) {
                        locationInput.value = previousState.location;
                    }
                    
                    // Event handlers
                    descriptionInput.addEventListener('input', saveState);
                    ${isCreateMode ? 'frameworkSelect.addEventListener("change", saveState);' : ''}
                    
                    browseButton.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'browse'
                        });
                    });
                    
                    generateBtn.addEventListener('click', () => {
                        const description = descriptionInput.value.trim();
                        const location = locationInput.value.trim();
                        
                        if (!description) {
                            showError('Please enter a description');
                            return;
                        }
                        
                        if (!location) {
                            showError('Please select a location');
                            return;
                        }
                        
                        ${isCreateMode ? `
                        vscode.postMessage({
                            command: 'generateApp',
                            description: description,
                            location: location,
                            framework: frameworkSelect.value
                        });
                        ` : `
                        vscode.postMessage({
                            command: 'updateApp',
                            requirements: description,
                            location: location
                        });
                        `}
                    });
                    
                    cancelBtn.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    });
                    
                    // Message handler
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        switch (message.command) {
                            case 'setLocation':
                                locationInput.value = message.location;
                                saveState();
                                break;
                                
                            case 'error':
                                showError(message.text);
                                hideProgress();
                                break;
                                
                            case 'startGeneration':
                            case 'startUpdate':
                                showProgress();
                                break;
                                
                            case 'generationComplete':
                            case 'updateComplete':
                                hideProgress();
                                break;
                        }
                    });
                    
                    function saveState() {
                        vscode.setState({
                            description: descriptionInput.value,
                            ${isCreateMode ? 'framework: frameworkSelect.value,' : ''}
                            location: locationInput.value
                        });
                    }
                    
                    function showError(message) {
                        const container = document.querySelector('.container');
                        const existing = document.querySelector('.error-message');
                        
                        if (existing) {
                            existing.remove();
                        }
                        
                        const errorDiv = document.createElement('div');
                        errorDiv.className = 'error-message';
                        errorDiv.textContent = message;
                        
                        container.insertBefore(errorDiv, container.firstChild);
                        
                        setTimeout(() => {
                            if (errorDiv.parentNode) {
                                errorDiv.remove();
                            }
                        }, 5000);
                    }
                    
                    function showProgress() {
                        progressContainer.style.display = 'block';
                        generateBtn.disabled = true;
                        cancelBtn.disabled = true;
                        descriptionInput.disabled = true;
                        ${isCreateMode ? 'frameworkSelect.disabled = true;' : ''}
                        locationInput.disabled = true;
                        browseButton.disabled = true;
                        
                        // Reset and restart animation for the progress bar
                        const progressFill = document.querySelector('.progress-fill');
                        if (progressFill) {
                            progressFill.classList.remove('progress-animate');
                            void progressFill.offsetWidth; // Trigger reflow
                            progressFill.classList.add('progress-animate');
                        }
                    }
                    
                    function hideProgress() {
                        progressContainer.style.display = 'none';
                        generateBtn.disabled = false;
                        cancelBtn.disabled = false;
                        descriptionInput.disabled = false;
                        ${isCreateMode ? 'frameworkSelect.disabled = false;' : ''}
                        locationInput.disabled = false;
                        browseButton.disabled = false;
                    }
                })();
            </script>
        </body>
        </html>`;
    }
}

/**
 * Generates a nonce string
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}