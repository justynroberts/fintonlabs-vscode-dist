import * as vscode from 'vscode';

/**
 * Manages history of file operations for undo functionality
 */
export class HistoryManager {
    private _operations: FileOperation[] = [];
    private _maxHistorySize: number = 100;
    
    /**
     * Records a file operation to the history
     */
    public recordOperation(operation: FileOperation) {
        this._operations.push(operation);
        
        // Limit history size
        if (this._operations.length > this._maxHistorySize) {
            this._operations.shift();
        }
    }
    
    /**
     * Undoes the last operation
     */
    public async undo(): Promise<void> {
        if (this._operations.length === 0) {
            vscode.window.showInformationMessage('Nothing to undo');
            return;
        }
        
        const lastOperation = this._operations.pop();
        if (lastOperation) {
            try {
                await lastOperation.undo();
                vscode.window.showInformationMessage('Operation undone successfully');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                vscode.window.showErrorMessage(`Failed to undo operation: ${errorMessage}`);
            }
        }
    }
}

/**
 * Interface for file operations that can be undone
 */
export interface FileOperation {
    undo(): Promise<void>;
}

/**
 * File creation operation
 */
export class FileCreateOperation implements FileOperation {
    constructor(private _filePath: string) {}
    
    async undo(): Promise<void> {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(this._filePath), { recursive: true });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to undo file creation: ${errorMessage}`);
        }
    }
}

/**
 * File update operation
 */
export class FileUpdateOperation implements FileOperation {
    constructor(
        private _filePath: string,
        private _previousContent: Uint8Array
    ) {}
    
    async undo(): Promise<void> {
        try {
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(this._filePath),
                this._previousContent
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to undo file update: ${errorMessage}`);
        }
    }
}

/**
 * File delete operation
 */
export class FileDeleteOperation implements FileOperation {
    constructor(
        private _filePath: string,
        private _previousContent: Uint8Array
    ) {}
    
    async undo(): Promise<void> {
        try {
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(this._filePath),
                this._previousContent
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to undo file deletion: ${errorMessage}`);
        }
    }
}
