#!/usr/bin/env python3

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
from pathlib import Path

# Set up plotting style
plt.style.use('default')
sns.set_palette("husl")

def load_data():
    """Load the out-of-order analysis data"""
    base_path = Path("/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-results/out-of-order-analysis")
    
    # Load summary data
    summary_df = pd.read_csv(base_path / "summary-out-of-order-analysis.csv")
    
    # Load detailed data
    detailed_df = pd.read_csv(base_path / "detailed-out-of-order-analysis.csv")
    
    return summary_df, detailed_df

def create_summary_plots(summary_df):
    """Create summary plots for out-of-order analysis"""
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Out-of-Order Event Analysis Summary', fontsize=16, fontweight='bold')
    
    # Plot 1: Out-of-Order Percentage by Client Count
    axes[0,0].plot(summary_df['Clients'], summary_df['Out_Of_Order_Percentage'], 
                   marker='o', linewidth=2, markersize=8, color='#e74c3c')
    axes[0,0].set_title('Out-of-Order Event Percentage', fontweight='bold')
    axes[0,0].set_xlabel('Number of Clients')
    axes[0,0].set_ylabel('Out-of-Order Events (%)')
    axes[0,0].grid(True, alpha=0.3)
    axes[0,0].set_ylim(0, max(summary_df['Out_Of_Order_Percentage']) * 1.1)
    
    # Plot 2: Average Latency by Client Count
    axes[0,1].plot(summary_df['Clients'], summary_df['Avg_Mean_Latency_ms']/1000, 
                   marker='s', linewidth=2, markersize=8, color='#3498db')
    axes[0,1].set_title('Average Out-of-Order Latency', fontweight='bold')
    axes[0,1].set_xlabel('Number of Clients')
    axes[0,1].set_ylabel('Average Latency (seconds)')
    axes[0,1].grid(True, alpha=0.3)
    
    # Plot 3: Threshold Violations
    axes[1,0].plot(summary_df['Clients'], summary_df['Exceeds_Delay_Percentage'], 
                   marker='^', linewidth=2, markersize=8, color='#f39c12')
    axes[1,0].set_title('Events Exceeding 30s Threshold', fontweight='bold')
    axes[1,0].set_xlabel('Number of Clients')
    axes[1,0].set_ylabel('Threshold Violations (%)')
    axes[1,0].grid(True, alpha=0.3)
    axes[1,0].axhline(y=30, color='red', linestyle='--', alpha=0.7, label='Critical Level (30%)')
    axes[1,0].legend()
    
    # Plot 4: Total Out-of-Order Events (absolute numbers)
    axes[1,1].bar(summary_df['Clients'], summary_df['Total_Out_Of_Order']/1000, 
                  color='#9b59b6', alpha=0.7)
    axes[1,1].set_title('Total Out-of-Order Events (in thousands)', fontweight='bold')
    axes[1,1].set_xlabel('Number of Clients')
    axes[1,1].set_ylabel('Out-of-Order Events (thousands)')
    axes[1,1].grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    return fig

def create_detailed_analysis_plots(detailed_df):
    """Create detailed analysis plots"""
    
    fig, axes = plt.subplots(2, 2, figsize=(15, 12))
    fig.suptitle('Detailed Out-of-Order Analysis', fontsize=16, fontweight='bold')
    
    # Plot 1: Box plot of out-of-order percentages by client count
    box_data = [detailed_df[detailed_df['Clients'] == i]['Out_Of_Order_Percentage'].values 
                for i in range(1, 11)]
    box_plot = axes[0,0].boxplot(box_data, labels=range(1, 11), patch_artist=True)
    axes[0,0].set_title('Distribution of Out-of-Order Percentages', fontweight='bold')
    axes[0,0].set_xlabel('Number of Clients')
    axes[0,0].set_ylabel('Out-of-Order Percentage')
    axes[0,0].grid(True, alpha=0.3)
    
    # Color the box plots
    colors = plt.cm.viridis(np.linspace(0, 1, 10))
    for patch, color in zip(box_plot['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    
    # Plot 2: Latency percentiles heatmap
    latency_cols = ['P50_Latency_ms', 'P75_Latency_ms', 'P90_Latency_ms', 'P95_Latency_ms', 'P99_Latency_ms']
    summary_by_clients = detailed_df.groupby('Clients')[latency_cols].mean()
    
    # Convert to seconds for better readability
    summary_by_clients = summary_by_clients / 1000
    
    sns.heatmap(summary_by_clients.T, annot=True, fmt='.1f', cmap='YlOrRd', 
                ax=axes[0,1], cbar_kws={'label': 'Latency (seconds)'})
    axes[0,1].set_title('Latency Percentiles by Client Count', fontweight='bold')
    axes[0,1].set_xlabel('Number of Clients')
    axes[0,1].set_ylabel('Percentile')
    
    # Plot 3: Scatter plot showing correlation between total events and out-of-order events
    colors_scatter = plt.cm.viridis(detailed_df['Clients']/10)
    scatter = axes[1,0].scatter(detailed_df['Total_Events']/1000, 
                               detailed_df['Out_Of_Order_Events']/1000,
                               c=colors_scatter, alpha=0.6, s=30)
    axes[1,0].set_title('Out-of-Order Events vs Total Events', fontweight='bold')
    axes[1,0].set_xlabel('Total Events (thousands)')
    axes[1,0].set_ylabel('Out-of-Order Events (thousands)')
    axes[1,0].grid(True, alpha=0.3)
    
    # Add colorbar for client count
    cbar = plt.colorbar(scatter, ax=axes[1,0])
    cbar.set_label('Number of Clients')
    
    # Plot 4: Threshold violations trend
    violation_data = detailed_df.groupby('Clients')['Exceeds_Delay_Percentage'].agg(['mean', 'std']).reset_index()
    axes[1,1].errorbar(violation_data['Clients'], violation_data['mean'], 
                       yerr=violation_data['std'], marker='o', linewidth=2, 
                       markersize=8, capsize=5, color='#e74c3c')
    axes[1,1].set_title('Threshold Violations with Variability', fontweight='bold')
    axes[1,1].set_xlabel('Number of Clients')
    axes[1,1].set_ylabel('Threshold Violations (%) ± Std Dev')
    axes[1,1].grid(True, alpha=0.3)
    axes[1,1].axhline(y=30, color='red', linestyle='--', alpha=0.7, label='Critical Level')
    axes[1,1].legend()
    
    plt.tight_layout()
    return fig

def create_performance_degradation_plot(summary_df):
    """Create a performance degradation analysis plot"""
    
    fig, ax = plt.subplots(1, 1, figsize=(12, 8))
    
    # Normalize all metrics to show relative degradation
    clients = summary_df['Clients'].values
    
    # Calculate relative increases (normalized to 1-client baseline)
    oo_relative = summary_df['Out_Of_Order_Percentage'] / summary_df['Out_Of_Order_Percentage'].iloc[0]
    latency_relative = summary_df['Avg_Mean_Latency_ms'] / summary_df['Avg_Mean_Latency_ms'].iloc[0]
    threshold_relative = summary_df['Exceeds_Delay_Percentage'] / max(summary_df['Exceeds_Delay_Percentage'].iloc[0], 0.1)  # Avoid division by zero
    
    # Plot the normalized degradation
    ax.plot(clients, oo_relative, marker='o', linewidth=3, markersize=8, 
            label='Out-of-Order Rate', color='#e74c3c')
    ax.plot(clients, latency_relative, marker='s', linewidth=3, markersize=8, 
            label='Average Latency', color='#3498db')
    ax.plot(clients, threshold_relative, marker='^', linewidth=3, markersize=8, 
            label='Threshold Violations', color='#f39c12')
    
    ax.set_title('Performance Degradation Analysis\n(Relative to 1-Client Baseline)', 
                 fontsize=14, fontweight='bold')
    ax.set_xlabel('Number of Clients', fontsize=12)
    ax.set_ylabel('Relative Performance Degradation (X times baseline)', fontsize=12)
    ax.legend(fontsize=11)
    ax.grid(True, alpha=0.3)
    ax.set_yscale('log')
    
    # Add annotations for key points
    ax.annotate(f'{latency_relative.iloc[-1]:.1f}x latency increase', 
                xy=(clients[-1], latency_relative.iloc[-1]), 
                xytext=(clients[-3], latency_relative.iloc[-1]*1.5),
                arrowprops=dict(arrowstyle='->', color='#3498db', alpha=0.7),
                fontsize=10, color='#3498db')
    
    plt.tight_layout()
    return fig

def main():
    """Main function to generate all visualizations"""
    
    print("Loading out-of-order analysis data...")
    summary_df, detailed_df = load_data()
    
    # Create output directory for plots
    output_dir = Path("/Users/kushbisen/Code/decentralized-stream-aggregator-evaluation/analysis-results/out-of-order-analysis/plots")
    output_dir.mkdir(exist_ok=True)
    
    print("Generating summary plots...")
    fig1 = create_summary_plots(summary_df)
    fig1.savefig(output_dir / "out-of-order-summary.png", dpi=300, bbox_inches='tight')
    
    print("Generating detailed analysis plots...")
    fig2 = create_detailed_analysis_plots(detailed_df)
    fig2.savefig(output_dir / "out-of-order-detailed.png", dpi=300, bbox_inches='tight')
    
    print("Generating performance degradation plot...")
    fig3 = create_performance_degradation_plot(summary_df)
    fig3.savefig(output_dir / "performance-degradation.png", dpi=300, bbox_inches='tight')
    
    print(f"All plots saved to: {output_dir}")
    
    # Print some key statistics
    print("\n" + "="*60)
    print("KEY STATISTICS")
    print("="*60)
    print(f"Maximum out-of-order rate: {summary_df['Out_Of_Order_Percentage'].max():.1f}%")
    print(f"Maximum latency: {summary_df['Avg_Mean_Latency_ms'].max()/1000:.1f} seconds")
    print(f"Maximum threshold violations: {summary_df['Exceeds_Delay_Percentage'].max():.1f}%")
    print(f"Performance degradation (1→10 clients): {summary_df['Avg_Mean_Latency_ms'].iloc[-1]/summary_df['Avg_Mean_Latency_ms'].iloc[0]:.1f}x")
    
    plt.show()

if __name__ == "__main__":
    main()
