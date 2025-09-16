#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

interface RefactorConfig {
    sourceRoot: string;
    targetStructure: {
        [key: string]: {
            description: string;
            files: string[];
            subdirs?: { [key: string]: string[] };
        };
    };
}

const config: RefactorConfig = {
    sourceRoot: '/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation',
    targetStructure: {
        'analysis-scripts': {
            description: 'All analysis TypeScript scripts',
            files: [
                'analyze-all-metrics-filtered.ts',
                'analyze-all-query-registrations.ts',
                'analyze-filtered-iterations.ts',
                'analyze-get-timing.ts',
                'analyze-query-registration-all-iterations.ts',
                'calculate-detailed-subscription.ts',
                'calculate-get-stats.ts',
                'calculate-query-registration.ts',
                'calculate-real-get-timing.ts',
                'calculate-subscription-timing.ts',
                'count-rsp-events.ts',
                'process-downloads-data.ts',
                'processAggregatorLog.ts',
                'test-log-analysis.ts'
            ]
        },
        'analysis-outputs': {
            description: 'Generated analysis output files',
            files: [
                'test-aggregation.log',
                'test-output.csv',
                'with-aggregator-analysis.csv'
            ]
        },
        'experimental-scripts': {
            description: 'Experimental and test scripts',
            files: [
                'comunica-query.ts',
                'comunica-test.ts',
                'initialise-LDES.ts',
                'multiple-client-subscribe.ts',
                'rspql-parser.ts',
                'rspql-test.ts'
            ]
        },
        'reports': {
            description: 'Final analysis reports and documentation',
            files: [
                'analysis-results/performance-comparison-table-1client.md',
                'analysis-results/corrected-analysis-summary.md',
                'analysis-results/get-request-timing-correction.md',
                'analysis-results/sequential-pairing-results.md',
                'analysis-results/webhook-approaches-comparison.md',
                'analysis-results/with-aggregator-vs-without-aggregator-summary.md'
            ],
            subdirs: {
                'out-of-order-analysis': ['analysis-results/out-of-order-analysis/*'],
                'with-aggregator-analysis': ['analysis-results/with-aggregator-analysis/*'],
                'enhanced-analysis': ['analysis-results/enhanced-with-aggregator-analysis/*']
            }
        },
        'archive': {
            description: 'Archived analysis materials',
            files: ['analysis-results/archive/*']
        }
    }
};

class FolderRefactor {
    private sourceRoot: string;
    private backupDir: string;
    private newStructureRoot: string;

    constructor(sourceRoot: string) {
        this.sourceRoot = sourceRoot;
        this.backupDir = path.join(sourceRoot, 'backup-before-refactor');
        this.newStructureRoot = path.join(sourceRoot, 'analysis-refactored');
    }

    async refactor(): Promise<void> {
        console.log('🔄 Starting folder refactoring process...');
        
        // Step 1: Create backup
        await this.createBackup();
        
        // Step 2: Create new structure
        await this.createNewStructure();
        
        // Step 3: Move files
        await this.moveFiles();
        
        // Step 4: Create documentation
        await this.createDocumentation();
        
        // Step 5: Clean up old files (optional)
        await this.cleanupOldFiles();
        
        console.log('✅ Refactoring completed successfully!');
        console.log(`📁 New structure available at: ${this.newStructureRoot}`);
        console.log(`💾 Backup created at: ${this.backupDir}`);
    }

    private async createBackup(): Promise<void> {
        console.log('📦 Creating backup...');
        
        if (fs.existsSync(this.backupDir)) {
            fs.rmSync(this.backupDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.backupDir, { recursive: true });

        // Backup analysis scripts
        const analysisFiles = this.getAllAnalysisFiles();
        for (const file of analysisFiles) {
            const sourcePath = path.join(this.sourceRoot, file);
            if (fs.existsSync(sourcePath)) {
                const targetPath = path.join(this.backupDir, file);
                fs.mkdirSync(path.dirname(targetPath), { recursive: true });
                fs.copyFileSync(sourcePath, targetPath);
            }
        }

        // Backup entire analysis-results directory
        const analysisResultsSource = path.join(this.sourceRoot, 'analysis-results');
        const analysisResultsBackup = path.join(this.backupDir, 'analysis-results');
        if (fs.existsSync(analysisResultsSource)) {
            this.copyDirectory(analysisResultsSource, analysisResultsBackup);
        }

        console.log('✅ Backup created');
    }

    private async createNewStructure(): Promise<void> {
        console.log('🏗️  Creating new folder structure...');
        
        if (fs.existsSync(this.newStructureRoot)) {
            fs.rmSync(this.newStructureRoot, { recursive: true, force: true });
        }

        for (const [folderName, folderConfig] of Object.entries(config.targetStructure)) {
            const folderPath = path.join(this.newStructureRoot, folderName);
            fs.mkdirSync(folderPath, { recursive: true });

            // Create subdirectories if specified
            if (folderConfig.subdirs) {
                for (const [subdirName] of Object.entries(folderConfig.subdirs)) {
                    const subdirPath = path.join(folderPath, subdirName);
                    fs.mkdirSync(subdirPath, { recursive: true });
                }
            }

            console.log(`  📁 Created: ${folderName}/`);
        }
    }

    private async moveFiles(): Promise<void> {
        console.log('📋 Moving files to new structure...');

        for (const [folderName, folderConfig] of Object.entries(config.targetStructure)) {
            const targetDir = path.join(this.newStructureRoot, folderName);

            // Move regular files
            for (const file of folderConfig.files) {
                const sourcePath = path.join(this.sourceRoot, file);
                const fileName = path.basename(file);
                const targetPath = path.join(targetDir, fileName);

                if (fs.existsSync(sourcePath)) {
                    if (fs.statSync(sourcePath).isDirectory()) {
                        this.copyDirectory(sourcePath, targetPath);
                    } else {
                        fs.copyFileSync(sourcePath, targetPath);
                    }
                    console.log(`  ✅ Moved: ${file} -> ${folderName}/${fileName}`);
                } else {
                    console.log(`  ⚠️  File not found: ${file}`);
                }
            }

            // Move subdirectory files
            if (folderConfig.subdirs) {
                for (const [subdirName, patterns] of Object.entries(folderConfig.subdirs)) {
                    const subdirTarget = path.join(targetDir, subdirName);
                    
                    for (const pattern of patterns) {
                        const resolvedPattern = path.join(this.sourceRoot, pattern);
                        const sourcePath = resolvedPattern.replace('/*', '');
                        
                        if (fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory()) {
                            this.copyDirectory(sourcePath, subdirTarget);
                            console.log(`  ✅ Moved directory: ${pattern} -> ${folderName}/${subdirName}/`);
                        }
                    }
                }
            }
        }
    }

    private async createDocumentation(): Promise<void> {
        console.log('📝 Creating documentation...');

        const readmeContent = this.generateReadmeContent();
        const readmePath = path.join(this.newStructureRoot, 'README.md');
        fs.writeFileSync(readmePath, readmeContent);

        // Create a migration log
        const migrationLogContent = this.generateMigrationLog();
        const migrationLogPath = path.join(this.newStructureRoot, 'MIGRATION-LOG.md');
        fs.writeFileSync(migrationLogPath, migrationLogContent);

        console.log('✅ Documentation created');
    }

    private async cleanupOldFiles(): Promise<void> {
        console.log('🧹 Cleaning up old files...');
        
        // This is optional - we'll just log what would be cleaned up
        const filesToCleanup = this.getAllAnalysisFiles();
        
        console.log('📋 Files that can be safely removed after verification:');
        for (const file of filesToCleanup) {
            const filePath = path.join(this.sourceRoot, file);
            if (fs.existsSync(filePath)) {
                console.log(`  - ${file}`);
            }
        }
        
        console.log('⚠️  Note: Old files were NOT automatically deleted. Please verify the new structure first.');
    }

    private getAllAnalysisFiles(): string[] {
        const allFiles: string[] = [];
        
        for (const folderConfig of Object.values(config.targetStructure)) {
            allFiles.push(...folderConfig.files);
            
            if (folderConfig.subdirs) {
                for (const patterns of Object.values(folderConfig.subdirs)) {
                    allFiles.push(...patterns);
                }
            }
        }
        
        return [...new Set(allFiles)]; // Remove duplicates
    }

    private copyDirectory(source: string, target: string): void {
        if (!fs.existsSync(source)) return;
        
        fs.mkdirSync(target, { recursive: true });
        
        const items = fs.readdirSync(source);
        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);
            
            if (fs.statSync(sourcePath).isDirectory()) {
                this.copyDirectory(sourcePath, targetPath);
            } else {
                fs.copyFileSync(sourcePath, targetPath);
            }
        }
    }

    private generateReadmeContent(): string {
        return `# Refactored Analysis Structure

This directory contains the refactored analysis structure for the decentralized stream aggregator evaluation project.

## Directory Structure

${Object.entries(config.targetStructure).map(([folderName, folderConfig]) => `
### \`${folderName}/\`
${folderConfig.description}

**Files:** ${folderConfig.files.length} files
${folderConfig.subdirs ? `**Subdirectories:** ${Object.keys(folderConfig.subdirs).join(', ')}` : ''}
`).join('\n')}

## Usage

### Running Analysis Scripts
\`\`\`bash
cd analysis-scripts
npx ts-node <script-name>.ts
\`\`\`

### Viewing Reports
The \`reports/\` directory contains all final analysis results and documentation.

### Experimental Scripts
The \`experimental-scripts/\` directory contains test and experimental code.

## Migration Information

- **Created:** ${new Date().toISOString()}
- **Source:** Original project root and analysis-results directory
- **Backup:** Available in \`backup-before-refactor/\` directory

## Key Analysis Scripts

1. **analyze-all-metrics-filtered.ts** - Comprehensive analysis using filtered iterations
2. **analyze-filtered-iterations.ts** - Query registration and subscription timing
3. **calculate-real-get-timing.ts** - GET request timing analysis
4. **process-downloads-data.ts** - Process experimental data from downloads

## Reports Summary

1. **performance-comparison-table-1client.md** - Main performance comparison table
2. **corrected-analysis-summary.md** - Corrected analysis methodology
3. **out-of-order-analysis/** - Out-of-order event analysis
4. **with-aggregator-analysis/** - Detailed aggregator performance analysis

For more details, see MIGRATION-LOG.md
`;
    }

    private generateMigrationLog(): string {
        return `# Migration Log

## Migration Details
- **Date:** ${new Date().toISOString()}
- **Source Directory:** ${this.sourceRoot}
- **Target Directory:** ${this.newStructureRoot}
- **Backup Directory:** ${this.backupDir}

## Files Moved

${Object.entries(config.targetStructure).map(([folderName, folderConfig]) => `
### ${folderName}/
${folderConfig.files.map(file => `- ${file}`).join('\n')}
${folderConfig.subdirs ? `\n**Subdirectories:**\n${Object.entries(folderConfig.subdirs).map(([subdir, patterns]) => `- ${subdir}/ (from ${patterns.join(', ')})`).join('\n')}` : ''}
`).join('\n')}

## Verification Steps

1. ✅ Backup created at \`${this.backupDir}\`
2. ✅ New structure created at \`${this.newStructureRoot}\`
3. ✅ Files copied to new locations
4. ✅ Documentation generated

## Next Steps

1. Verify the new structure works correctly
2. Update any import paths in scripts
3. Update CI/CD configurations if applicable
4. Remove old files after verification (optional)

## Rollback Instructions

If needed, you can rollback by:
1. Restoring files from \`${this.backupDir}\`
2. Removing \`${this.newStructureRoot}\`

## Modified Files

The following files may need path updates:
- Any scripts importing other analysis scripts
- Package.json scripts section
- README.md references
- CI/CD configuration files
`;
    }
}

// Main execution
async function main() {
    try {
        const refactor = new FolderRefactor(config.sourceRoot);
        await refactor.refactor();
    } catch (error) {
        console.error('❌ Refactoring failed:', error);
        process.exit(1);
    }
}

// Run only if this script is executed directly
if (require.main === module) {
    main();
}

export { FolderRefactor, config };
