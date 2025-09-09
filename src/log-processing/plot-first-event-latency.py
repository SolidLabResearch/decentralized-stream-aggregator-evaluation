#!/usr/bin/env python3
"""
First Event Latency vs Number of Clients Plot Generator

This script creates a visualization of first event latency across different
client configurations to understand the impact of system load on response times.
"""

import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from pathlib import Path

# Set up plotting style
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

def load_data():
    """Load the detailed latency results CSV file."""
    csv_path = Path(__file__).parent.parent.parent / "analysis-results" / "csv-data" / "without-aggregator-detailed-with-latency-results.csv"
    
    if not csv_path.exists():
        raise FileNotFoundError(f"Data file not found: {csv_path}")
    
    df = pd.read_csv(csv_path)
    return df

def create_first_event_latency_plot(df):
    """Create a comprehensive plot of first event latency vs number of clients."""
    
    # Convert milliseconds to minutes for better readability
    df['First_Event_Latency_min'] = df['First_Event_Latency_ms'] / (1000 * 60)
    
    # Calculate statistics for each client configuration
    stats = df.groupby('Clients')['First_Event_Latency_min'].agg([
        'mean', 'median', 'std', 'min', 'max', 'count'
    ]).reset_index()
    
    # Create figure with subplots
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(16, 12))
    fig.suptitle('First Event Latency Analysis: Impact of Client Load\nDecentralized Stream Aggregator Performance Evaluation', 
                 fontsize=16, fontweight='bold', y=0.98)
    
    # Plot 1: Box plot showing distribution for each client count
    ax1.set_title('First Event Latency Distribution by Client Count', fontsize=14, fontweight='bold')
    
    # Create box plot data
    client_counts = sorted(df['Clients'].unique())
    box_data = [df[df['Clients'] == c]['First_Event_Latency_min'].values for c in client_counts]
    
    box_plot = ax1.boxplot(box_data, tick_labels=client_counts, patch_artist=True)
    
    # Color the boxes with a gradient
    colors = plt.cm.viridis(np.linspace(0, 1, len(box_plot['boxes'])))
    for patch, color in zip(box_plot['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)
    
    ax1.set_xlabel('Number of Clients', fontsize=12)
    ax1.set_ylabel('First Event Latency (minutes)', fontsize=12)
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim(bottom=0)
    
    # Plot 2: Mean latency with error bars
    ax2.set_title('Average First Event Latency with Standard Deviation', fontsize=14, fontweight='bold')
    
    ax2.errorbar(stats['Clients'], stats['mean'], yerr=stats['std'], 
                marker='o', markersize=8, linewidth=2, capsize=5, capthick=2,
                color='darkblue', ecolor='lightblue', markerfacecolor='red', markeredgecolor='darkred')
    
    ax2.set_xlabel('Number of Clients', fontsize=12)
    ax2.set_ylabel('Average First Event Latency (minutes)', fontsize=12)
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(bottom=0)
    
    # Add trend line
    z = np.polyfit(stats['Clients'], stats['mean'], 2)  # Quadratic fit
    p = np.poly1d(z)
    x_trend = np.linspace(stats['Clients'].min(), stats['Clients'].max(), 100)
    ax2.plot(x_trend, p(x_trend), "--", alpha=0.8, color='red', linewidth=2, label='Trend (Quadratic)')
    ax2.legend()
    
    # Plot 3: Violin plot for detailed distribution
    ax3.set_title('Latency Distribution Density by Client Count', fontsize=14, fontweight='bold')
    
    # Prepare data for violin plot
    violin_data = []
    violin_labels = []
    for client_count in client_counts:
        client_data = df[df['Clients'] == client_count]['First_Event_Latency_min'].values
        if len(client_data) > 0:  # Only include if we have data
            violin_data.append(client_data)
            violin_labels.append(str(client_count))
    
    if violin_data:
        violin_parts = ax3.violinplot(violin_data, positions=range(1, len(violin_data) + 1), 
                                     showmeans=True, showmedians=True)
        
        # Color the violins
        colors = plt.cm.plasma(np.linspace(0, 1, len(violin_parts['bodies'])))
        for pc, color in zip(violin_parts['bodies'], colors):
            pc.set_facecolor(color)
            pc.set_alpha(0.7)
    
    ax3.set_xticks(range(1, len(violin_labels) + 1))
    ax3.set_xticklabels(violin_labels)
    ax3.set_xlabel('Number of Clients', fontsize=12)
    ax3.set_ylabel('First Event Latency (minutes)', fontsize=12)
    ax3.grid(True, alpha=0.3)
    ax3.set_ylim(bottom=0)
    
    # Plot 4: Scatter plot with trend analysis
    ax4.set_title('Individual Measurements and Performance Degradation', fontsize=14, fontweight='bold')
    
    # Color points by client count
    colors_scatter = plt.cm.tab10(np.linspace(0, 1, len(client_counts)))
    
    for i, client_count in enumerate(client_counts):
        client_data = df[df['Clients'] == client_count]
        ax4.scatter(client_data['Clients'], client_data['First_Event_Latency_min'], 
                   alpha=0.6, s=30, color=colors_scatter[i], label=f'{client_count} clients')
    
    # Add mean line
    ax4.plot(stats['Clients'], stats['mean'], 'o-', linewidth=3, markersize=8, 
            color='red', label='Average Latency')
    
    ax4.set_xlabel('Number of Clients', fontsize=12)
    ax4.set_ylabel('First Event Latency (minutes)', fontsize=12)
    ax4.grid(True, alpha=0.3)
    ax4.set_ylim(bottom=0)
    ax4.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
    
    # Adjust layout
    plt.tight_layout()
    
    return fig, stats

def print_statistics(stats):
    """Print detailed statistics about first event latency."""
    print("\n" + "="*80)
    print("FIRST EVENT LATENCY ANALYSIS SUMMARY")
    print("="*80)
    
    print(f"{'Clients':<8} {'Mean (min)':<12} {'Median (min)':<13} {'Std Dev':<12} {'Min (min)':<10} {'Max (min)':<10} {'Samples':<8}")
    print("-" * 80)
    
    for _, row in stats.iterrows():
        print(f"{row['Clients']:<8} {row['mean']:<12.1f} {row['median']:<13.1f} {row['std']:<12.1f} "
              f"{row['min']:<10.1f} {row['max']:<10.1f} {row['count']:<8}")
    
    # Calculate degradation factors
    print("\n" + "="*60)
    print("PERFORMANCE DEGRADATION ANALYSIS")
    print("="*60)
    
    baseline_mean = stats.iloc[0]['mean']  # 1 client baseline
    
    print(f"{'Clients':<8} {'Latency (min)':<15} {'vs 1-client':<12} {'Degradation':<12}")
    print("-" * 60)
    
    for _, row in stats.iterrows():
        degradation_factor = row['mean'] / baseline_mean
        degradation_percent = (degradation_factor - 1) * 100
        
        if degradation_percent > 0:
            degradation_str = f"+{degradation_percent:.1f}%"
        else:
            degradation_str = f"{degradation_percent:.1f}%"
        
        print(f"{row['Clients']:<8} {row['mean']:<15.1f} {degradation_factor:<12.2f}x {degradation_str:<12}")

def main():
    """Main function to generate the first event latency analysis."""
    try:
        # Load data
        print("Loading first event latency data...")
        df = load_data()
        
        # Create the plot
        print("Creating first event latency visualization...")
        fig, stats = create_first_event_latency_plot(df)
        
        # Save the plot
        output_path = Path(__file__).parent.parent.parent / "analysis-results" / "reports" / "first-event-latency-plot.png"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
        print(f"Plot saved to: {output_path}")
        
        # Print statistics
        print_statistics(stats)
        
        # Show the plot
        plt.show()
        
        print(f"\nAnalysis complete! First event latency plot saved to:")
        print(f"  {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
