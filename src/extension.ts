import * as vscode from 'vscode';
import { AICodeGeneratorService } from './aiCodeGenerator';
import { HistoryManager } from './historyManager';
import { FileSystemService } from './fileSystemService';
import { CodeGeneratorPanel } from './webview';

/**
 * Activates the extension
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize services
    const historyManager = new HistoryManager();
    const fileSystemService = new FileSystemService(historyManager);
    const aiCodeGenerator = new AICodeGeneratorService(context, fileSystemService);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('fintonlabs.createApp', () => {
            CodeGeneratorPanel.createOrShow(context.extensionUri, aiCodeGenerator, 'create');
        }),
        
        vscode.commands.registerCommand('fintonlabs.updateApp', () => {
            CodeGeneratorPanel.createOrShow(context.extensionUri, aiCodeGenerator, 'update');
        }),
        
        vscode.commands.registerCommand('fintonlabs.undo', () => {
            historyManager.undo();
        }),
        
        vscode.commands.registerCommand('fintonlabs.generateComponent', async () => {
            const componentDescription = await vscode.window.showInputBox({
                prompt: 'Describe the component you want to generate',
                placeHolder: 'e.g., A responsive navigation bar with dropdown menus and mobile view'
            });
            
            if (componentDescription) {
                const targetPath = await getTargetPath();
                if (targetPath) {
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Generating component...',
                        cancellable: false
                    }, async (progress) => {
                        try {
                            const result = await aiCodeGenerator.generateComponent(componentDescription, targetPath);
                            vscode.window.showInformationMessage(`Component generated at ${result.filePath}`);
                            const doc = await vscode.workspace.openTextDocument(result.filePath);
                            await vscode.window.showTextDocument(doc);
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            vscode.window.showErrorMessage(`Failed to generate component: ${errorMessage}`);
                        }
                    });
                }
            }
        }),
        
        vscode.commands.registerCommand('fintonlabs.generateFunction', async () => {
            const functionDescription = await vscode.window.showInputBox({
                prompt: 'Describe the function you want to generate',
                placeHolder: 'e.g., A function that validates email addresses and returns proper error messages'
            });
            
            if (functionDescription) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Generating function...',
                        cancellable: false
                    }, async (progress) => {
                        try {
                            const result = await aiCodeGenerator.generateFunction(functionDescription, editor.document.languageId);
                            const position = editor.selection.active;
                            editor.edit(editBuilder => {
                                editBuilder.insert(position, result.code);
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            vscode.window.showErrorMessage(`Failed to generate function: ${errorMessage}`);
                        }
                    });
                } else {
                    vscode.window.showErrorMessage('No active editor to insert function');
                }
            }
        })
    );
    
    // Helper function to get target path for component
    async function getTargetPath(): Promise<string | undefined> {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select Location',
            filters: {
                'JavaScript': ['js', 'jsx'],
                'TypeScript': ['ts', 'tsx'],
                'Vue': ['vue'],
                'Svelte': ['svelte'],
                'All Files': ['*']
            }
        };
        
        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            return fileUri[0].fsPath;
        }
        return undefined;
    }
}

export function deactivate() {}
