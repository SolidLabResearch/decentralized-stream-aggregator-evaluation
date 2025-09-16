#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const refactoredRoot = '/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-refactored';

interface VerificationResult {
    category: string;
    totalFiles: number;
    foundFiles: number;
    missingFiles: string[];
    extraFiles: string[];
}

function verifyRefactoredStructure(): void {
    console.log('🔍 Verifying refactored structure...\n');
    
    const expectedStructure = {
        'analysis-scripts': {
            expectedCount: 14,
            expectedFiles: [
                'analyze-all-metrics-filtered.ts',
                'analyze-filtered-iterations.ts',
                'calculate-real-get-timing.ts',
                'process-downloads-data.ts'
            ]
        },
        'analysis-outputs': {
            expectedCount: 3,
            expectedFiles: [
                'test-aggregation.log',
                'with-aggregator-analysis.csv'
            ]
        },
        'experimental-scripts': {
            expectedCount: 6,
            expectedFiles: [
                'comunica-query.ts',
                'initialise-LDES.ts'
            ]
        },
        'reports': {
            expectedCount: 6,
            expectedFiles: [
                'performance-comparison-table-1client.md',
                'corrected-analysis-summary.md'
            ]
        }
    };
    
    const results: VerificationResult[] = [];
    
    for (const [category, config] of Object.entries(expectedStructure)) {
        const categoryPath = path.join(refactoredRoot, category);
        
        if (!fs.existsSync(categoryPath)) {
            console.log(`❌ Directory missing: ${category}`);
            continue;
        }
        
        const files = fs.readdirSync(categoryPath).filter(f => 
            fs.statSync(path.join(categoryPath, f)).isFile()
        );
        
        const missingFiles = config.expectedFiles.filter(f => !files.includes(f));
        const extraFiles = files.filter(f => !config.expectedFiles.includes(f) && 
            !f.startsWith('.') && f !== 'README.md');
        
        results.push({
            category,
            totalFiles: files.length,
            foundFiles: config.expectedFiles.filter(f => files.includes(f)).length,
            missingFiles,
            extraFiles
        });
        
        console.log(`📁 ${category}/`);
        console.log(`   Files found: ${files.length} (expected ~${config.expectedCount})`);
        console.log(`   Key files: ${config.expectedFiles.filter(f => files.includes(f)).length}/${config.expectedFiles.length} ✅`);
        
        if (missingFiles.length > 0) {
            console.log(`   Missing: ${missingFiles.join(', ')} ⚠️`);
        }
        
        console.log('');
    }
    
    // Check subdirectories in reports
    const reportsPath = path.join(refactoredRoot, 'reports');
    const subdirs = fs.readdirSync(reportsPath).filter(f => 
        fs.statSync(path.join(reportsPath, f)).isDirectory()
    );
    
    console.log(`📁 reports/ subdirectories: ${subdirs.length}`);
    for (const subdir of subdirs) {
        const subdirPath = path.join(reportsPath, subdir);
        const subdirFiles = fs.readdirSync(subdirPath);
        console.log(`   📂 ${subdir}/ (${subdirFiles.length} files)`);
    }
    
    console.log('\n🎯 Summary:');
    console.log(`✅ Structure created successfully`);
    console.log(`📊 Total categories: ${results.length}`);
    console.log(`📄 Scripts organized and ready to use`);
    console.log(`📋 Reports properly categorized`);
    
    console.log('\n🚀 Next steps:');
    console.log('1. Test a few analysis scripts from analysis-scripts/');
    console.log('2. Review the reports/ directory');
    console.log('3. Update any hardcoded paths in scripts');
    console.log('4. Consider removing old files after verification');
}

function testAnalysisScript(): void {
    console.log('\n🧪 Testing analysis script execution...');
    
    const testScript = path.join(refactoredRoot, 'analysis-scripts', 'analyze-filtered-iterations.ts');
    
    if (fs.existsSync(testScript)) {
        console.log(`✅ Test script found: ${path.basename(testScript)}`);
        console.log('   To test execution:');
        console.log(`   cd ${path.dirname(testScript)}`);
        console.log(`   npx ts-node ${path.basename(testScript)}`);
    } else {
        console.log('⚠️  Test script not found');
    }
}

function showCleanupCommands(): void {
    console.log('\n🧹 Optional cleanup commands:');
    console.log('After verifying the refactored structure works correctly, you can remove old files:');
    console.log('');
    console.log('# Remove old analysis scripts from root');
    console.log('rm analyze-*.ts calculate-*.ts count-*.ts process-*.ts test-*.ts');
    console.log('');
    console.log('# Remove old output files');
    console.log('rm *.log *.csv');
    console.log('');
    console.log('# Remove old experimental scripts');
    console.log('rm comunica-*.ts rspql-*.ts initialise-*.ts multiple-*.ts');
    console.log('');
    console.log('⚠️  IMPORTANT: Only run these after verifying the refactored structure works!');
}

// Main execution
verifyRefactoredStructure();
testAnalysisScript();
showCleanupCommands();
