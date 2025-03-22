import * as vscode from 'vscode';
import * as path from 'path';
import { HistoryManager, FileCreateOperation, FileUpdateOperation, FileDeleteOperation } from './historyManager';

/**
 * Service for handling file system operations with undo capability
 */
export class FileSystemService {
    constructor(private _historyManager: HistoryManager) {}
    
    /**
     * Creates a file with the specified content
     */
    public async createFile(filePath: string, content: string): Promise<void> {
        try {
            // Ensure the directory exists
            await this.ensureDirectory(path.dirname(filePath));
            
            // Check if file already exists
            const exists = await this.fileExists(filePath);
            if (exists) {
                throw new Error(`File already exists: ${filePath}`);
            }
            
            // Write the file
            const contentBuffer = Buffer.from(content, 'utf8');
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), contentBuffer);
            
            // Record operation for undo
            this._historyManager.recordOperation(new FileCreateOperation(filePath));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to create file: ${errorMessage}`);
        }
    }
    
    /**
     * Updates an existing file with new content
     */
    public async updateFile(filePath: string, content: string): Promise<void> {
        try {
            // Check if file exists
            const exists = await this.fileExists(filePath);
            if (!exists) {
                throw new Error(`File does not exist: ${filePath}`);
            }
            
            // Read existing content for undo operation
            const existingContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            
            // Write the new content
            const contentBuffer = Buffer.from(content, 'utf8');
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), contentBuffer);
            
            // Record operation for undo
            this._historyManager.recordOperation(new FileUpdateOperation(filePath, existingContent));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to update file: ${errorMessage}`);
        }
    }
    
    /**
     * Deletes a file
     */
    public async deleteFile(filePath: string): Promise<void> {
        try {
            // Check if file exists
            const exists = await this.fileExists(filePath);
            if (!exists) {
                throw new Error(`File does not exist: ${filePath}`);
            }
            
            // Read existing content for undo operation
            const existingContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            
            // Delete the file
            await vscode.workspace.fs.delete(vscode.Uri.file(filePath), { recursive: false });
            
            // Record operation for undo
            this._historyManager.recordOperation(new FileDeleteOperation(filePath, existingContent));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to delete file: ${errorMessage}`);
        }
    }
    
    /**
     * Reads a file and returns its content as a string
     */
    public async readFile(filePath: string): Promise<string> {
        try {
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return Buffer.from(content).toString('utf8');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to read file: ${errorMessage}`);
        }
    }
    
    /**
     * Checks if a file exists
     */
    public async fileExists(filePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Ensures a directory exists, creating it if necessary
     */
    public async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(dirPath));
        } catch {
            // Directory doesn't exist, create it
            try {
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to create directory: ${errorMessage}`);
            }
        }
    }
}
