import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, PieChart, BarChart3, Calendar, Users, RefreshCw } from 'lucide-react';

export default function ProfessionalAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState({
    tickets_per_week: [],
    priority_distribution: {},
    type_distribution: {},
    assignment_distribution: {},
    avg_resolution_time: 0.0,
    total_tickets: 0,
    resolved_tickets: 0,
    weekly_average: 0.0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('overview');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/analytics/filtered?time=${timeFilter}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received analytics data:', data); // Debug: Check full data in console
      setAnalytics(data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToMain = () => {
    if (window.history && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const calculateMetrics = () => {
  const weeklyData = analytics.tickets_per_week || [];
  const totalTickets = analytics.total_tickets || weeklyData.reduce((sum, week) => sum + (week.count || 0), 0);
  const priorityData = analytics.priority_distribution || {};
  const typeData = analytics.type_distribution || {};
  
  // Priorité au backend pour weekly_average, fallback au calcul local
  const weeklyAverage = analytics.weekly_average || (totalTickets > 0 ? totalTickets / Math.max(weeklyData.length, 1) : 0);
  
  console.log('calculateMetrics - Backend values:', { totalTickets: analytics.total_tickets, weeklyAverage: analytics.weekly_average, weeklyDataLength: weeklyData.length });
  console.log('Calculated weeklyAverage:', weeklyAverage);
  
  const recentWeeks = weeklyData.slice(-4);
  let trend = 'stable';
  let trendValue = 0;
  
  if (recentWeeks.length >= 2) {
    const firstHalf = recentWeeks.slice(0, Math.floor(recentWeeks.length / 2));
    const secondHalf = recentWeeks.slice(Math.floor(recentWeeks.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, w) => sum + (w.count || 0), 0) / Math.max(firstHalf.length, 1);
    const secondAvg = secondHalf.reduce((sum, w) => sum + (w.count || 0), 0) / Math.max(secondHalf.length, 1);
    
    if (firstAvg > 0) {
      trendValue = ((secondAvg - firstAvg) / firstAvg * 100);
      trend = trendValue > 10 ? 'up' : trendValue < -10 ? 'down' : 'stable';
    }
  }

  const highPriorityCount = (priorityData['High'] || 0) + (priorityData['Highest'] || 0) + (priorityData['Critical'] || 0);
  
  const mostCommonType = Object.keys(typeData).reduce((a, b) => 
    (typeData[a] || 0) > (typeData[b] || 0) ? a : b, Object.keys(typeData)[0] || 'N/A'
  );

  const avgResolutionTime = analytics.avg_resolution_time || 0;
  const noteForAverage = avgResolutionTime === 0 ? ' (No resolved tickets in period)' : '';

  return {
    totalTickets,
    avgResolutionTime,
    highPriorityCount,
    mostCommonType,
    trend,
    trendValue: Math.abs(trendValue),
    weeklyAverage,
    noteForAverage
  };
};

  const metrics = calculateMetrics();

  const KPICard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = "#667eea", unit = "" }) => {
    const trendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : BarChart3;
    const trendColor = trend === 'up' ? '#10B981' : trend === 'down' ? '#EF4444' : '#6B7280';
    const TrendIcon = trendIcon;

    return (
      <div 
        style={{
          background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          color: isDarkMode ? '#ffffff' : '#1a202c'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        }}
      >
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${color}, ${color}99)`
        }} />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div 
            style={{
              display: 'inline-flex',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: `${color}15`
            }}
          >
            <Icon 
              size={28} 
              style={{ color: color }} 
            />
          </div>
          {trend && trendValue > 0 && (
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: trendColor,
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <TrendIcon size={14} />
              <span>{trendValue.toFixed(1)}%</span>
            </div>
          )}
        </div>
        
        <div>
          <h3 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: isDarkMode ? '#ffffff' : '#1a202c',
            margin: '0 0 8px 0',
            lineHeight: '1.2'
          }}>
            {value}{unit}
          </h3>
          <p style={{
            fontSize: '14px',
            fontWeight: '600',
            color: isDarkMode ? '#e2e8f0' : '#4a5568',
            margin: '0 0 4px 0'
          }}>
            {title}
          </p>
          {subtitle && (
            <p style={{
              fontSize: '12px',
              color: isDarkMode ? '#cbd5e0' : '#718096',
              margin: 0
            }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  };

  const DonutChart = ({ data, title, centerText }) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div style={{
          background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
          color: isDarkMode ? '#ffffff' : '#1a202c'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: isDarkMode ? '#ffffff' : '#1a202c',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {title}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '320px',
            color: isDarkMode ? '#9ca3af' : '#9ca3af',
            textAlign: 'center'
          }}>
            <div>
              <PieChart size={48} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>No data available</p>
            </div>
          </div>
        </div>
      );
    }

    const entries = Object.entries(data);
    const total = entries.reduce((sum, [_, value]) => sum + value, 0);
    const colors = ['#667eea', '#764ba2', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

    let cumulativeAngle = 0;
    const radius = 90;
    const innerRadius = 55;
    const centerX = 130;
    const centerY = 130;

    return (
      <div style={{
        background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
        color: isDarkMode ? '#ffffff' : '#1a202c'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: isDarkMode ? '#ffffff' : '#1a202c',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          {title}
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '30px' }}>
          <div style={{ position: 'relative' }}>
            <svg width="260" height="260" style={{ overflow: 'visible' }}>
              {entries.map(([name, value], index) => {
                const percentage = (value / total) * 100;
                const angle = (value / total) * 360;
                const startAngle = cumulativeAngle;
                const endAngle = cumulativeAngle + angle;
                
                const startRad = (startAngle * Math.PI) / 180;
                const endRad = (endAngle * Math.PI) / 180;
                
                const x1Outer = centerX + radius * Math.cos(startRad);
                const y1Outer = centerY + radius * Math.sin(startRad);
                const x2Outer = centerX + radius * Math.cos(endRad);
                const y2Outer = centerY + radius * Math.sin(endRad);
                
                const x1Inner = centerX + innerRadius * Math.cos(startRad);
                const y1Inner = centerY + innerRadius * Math.sin(startRad);
                const x2Inner = centerX + innerRadius * Math.cos(endRad);
                const y2Inner = centerY + innerRadius * Math.sin(endRad);
                
                const largeArcFlag = angle > 180 ? 1 : 0;
                
                const pathData = [
                  `M ${x1Inner} ${y1Inner}`,
                  `L ${x1Outer} ${y1Outer}`,
                  `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
                  `L ${x2Inner} ${y2Inner}`,
                  `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}`,
                  'Z'
                ].join(' ');
                
                cumulativeAngle += angle;
                
                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={colors[index % colors.length]}
                    stroke="#fff"
                    strokeWidth="3"
                    style={{ 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.opacity = '0.8';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.opacity = '1';
                    }}
                  >
                    <title>{`${name}: ${value} (${percentage.toFixed(1)}%)`}</title>
                  </path>
                );
              })}
            </svg>
            
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: isDarkMode ? '#ffffff' : '#1a202c'
            }}>
              <div style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: isDarkMode ? '#ffffff' : '#1a202c',
                lineHeight: '1'
              }}>
                {total}
              </div>
              <div style={{
                fontSize: '14px',
                color: isDarkMode ? '#e2e8f0' : '#718096',
                marginTop: '4px'
              }}>
                {centerText}
              </div>
            </div>
          </div>
          
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {entries.map(([name, value], index) => {
                const percentage = ((value / total) * 100).toFixed(1);
                return (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    marginBottom: '12px',
                    background: isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #f7fafc, #edf2f7)',
                    borderRadius: '12px',
                    border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                    transition: 'all 0.3s ease',
                    color: isDarkMode ? '#ffffff' : '#2d3748'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? '#2d3748' : '#edf2f7';
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #f7fafc, #edf2f7)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div 
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: colors[index % colors.length],
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      />
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: isDarkMode ? '#e2e8f0' : '#2d3748'
                      }}>
                        {name}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: isDarkMode ? '#e2e8f0' : '#2d3748'
                      }}>
                        {value}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: isDarkMode ? '#cbd5e0' : '#718096'
                      }}>
                        {percentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WeeklyTrendChart = ({ data, title }) => {
    if (!data || data.length === 0) {
      return (
        <div style={{
          background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
          color: isDarkMode ? '#ffffff' : '#1a202c'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: isDarkMode ? '#ffffff' : '#1a202c',
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            {title}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '320px',
            color: isDarkMode ? '#9ca3af' : '#9ca3af',
            textAlign: 'center'
          }}>
            <div>
              <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p>No data available</p>
            </div>
          </div>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(item => item.count || 0));
    const recentData = data.slice(-8);

    return (
      <div style={{
        background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
        color: isDarkMode ? '#ffffff' : '#1a202c'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: isDarkMode ? '#ffffff' : '#1a202c',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          {title}
        </h3>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {recentData.map((item, index) => {
            const percentage = maxValue > 0 ? (item.count / maxValue) * 100 : 0;
            const isHighest = item.count === maxValue;
            
            return (
              <div key={index} style={{
                padding: '20px',
                marginBottom: '16px',
                background: isDarkMode 
                  ? (isHighest ? '#1a202c' : '#2d3748')
                  : (isHighest ? 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' : 'linear-gradient(135deg, #f7fafc, #edf2f7)'),
                borderRadius: '12px',
                border: isHighest ? '2px solid ' + (isDarkMode ? '#60a5fa' : '#0ea5e9') : '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                transition: 'all 0.3s ease',
                color: isDarkMode ? '#e2e8f0' : '#2d3748'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: isDarkMode ? '#e2e8f0' : '#2d3748'
                  }}>
                    {item.week}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: isHighest ? (isDarkMode ? '#60a5fa' : '#0ea5e9') : (isDarkMode ? '#93c5fd' : '#667eea')
                    }}>
                      {item.count}
                    </span>
                    {isHighest && (
                      <span style={{
                        fontSize: '12px',
                        background: isDarkMode ? 'linear-gradient(135deg, #60a5fa, #3b82f6)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '12px',
                        fontWeight: '600'
                      }}>
                        Peak
                      </span>
                    )}
                  </div>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: isDarkMode ? '#4a5568' : '#e2e8f0',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: isHighest 
                      ? (isDarkMode ? 'linear-gradient(90deg, #60a5fa, #3b82f6)' : 'linear-gradient(90deg, #0ea5e9, #0284c7)')
                      : (isDarkMode ? 'linear-gradient(90deg, #93c5fd, #60a5fa)' : 'linear-gradient(90deg, #667eea, #764ba2)'),
                    borderRadius: '4px',
                    transition: 'width 0.8s ease-out'
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const InsightsPanel = () => {
    const insights = [
      {
        icon: TrendingUp,
        title: "Tendance de Charge de Travail",
        description: `${metrics.trend === 'up' ? 'Augmentation' : metrics.trend === 'down' ? 'Diminution' : 'Stable'} du volume des tickets au cours des dernières semaines`,
        color: metrics.trend === 'up' ? '#F59E0B' : metrics.trend === 'down' ? '#10B981' : '#6B7280',
        status: metrics.trend === 'up' ? 'warning' : metrics.trend === 'down' ? 'success' : 'neutral'
      },
      {
        icon: AlertCircle,
        title: "Priorité des Tickets",
        description: `${metrics.highPriorityCount} tickets prioritaires nécessitent une attention immédiate`,
        color: metrics.highPriorityCount > 0 ? '#EF4444' : '#10B981',
        status: metrics.highPriorityCount > 0 ? 'critical' : 'success'
      },
      {
        icon: Clock,
        title: "Efficacité de Résolution",
        description: `Temps de résolution moyen de ${metrics.avgResolutionTime.toFixed(1)} jours${metrics.noteForAverage}`,
        color: metrics.avgResolutionTime <= 3 ? '#10B981' : metrics.avgResolutionTime <= 7 ? '#F59E0B' : '#EF4444',
        status: metrics.avgResolutionTime <= 3 ? 'excellent' : metrics.avgResolutionTime <= 7 ? 'bon' : 'à améliorer'
      },
      {
        icon: PieChart,
        title: "Modèle de Problème",
        description: `${metrics.mostCommonType} est le type de problème le plus fréquent`,
        color: '#8B5CF6',
        status: 'info'
      }
    ];

    return (
      <div style={{
        background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
        color: isDarkMode ? '#ffffff' : '#1a202c'
      }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: isDarkMode ? '#ffffff' : '#1a202c',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Informations Clés
        </h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div key={index} style={{
                padding: '20px',
                background: isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #f7fafc, #edf2f7)',
                borderRadius: '12px',
                border: `1px solid ${isDarkMode ? '#2d3748' : '#e2e8f0'}`,
                borderLeft: `4px solid ${insight.color}`,
                transition: 'all 0.3s ease',
                color: isDarkMode ? '#e2e8f0' : '#2d3748'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
                  <div 
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: `${insight.color}15`,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <Icon size={24} style={{ color: insight.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <h4 style={{
                        fontWeight: '600',
                        color: isDarkMode ? '#e2e8f0' : '#2d3748',
                        margin: 0,
                        fontSize: '16px'
                      }}>
                        {insight.title}
                      </h4>
                      <span style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '12px',
                        backgroundColor: 
                          insight.status === 'critical' ? (isDarkMode ? '#fee2e2' : '#fee2e2') :
                          insight.status === 'warning' ? (isDarkMode ? '#fef3c7' : '#fef3c7') :
                          insight.status === 'success' ? (isDarkMode ? '#dcfce7' : '#dcfce7') :
                          insight.status === 'excellent' ? (isDarkMode ? '#d1fae5' : '#d1fae5') :
                          (isDarkMode ? '#2d3748' : '#f3f4f6'),
                        color:
                          insight.status === 'critical' ? '#dc2626' :
                          insight.status === 'warning' ? '#d97706' :
                          insight.status === 'success' ? '#16a34a' :
                          insight.status === 'excellent' ? '#059669' :
                          (isDarkMode ? '#e2e8f0' : '#6b7280')
                      }}>
                        {insight.status}
                      </span>
                    </div>
                    <p style={{
                      fontSize: '14px',
                      color: isDarkMode ? '#cbd5e0' : '#718096',
                      margin: 0,
                      lineHeight: '1.5'
                    }}>
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: isDarkMode ? '#000000' : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        color: isDarkMode ? '#ffffff' : '#1a202c'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          background: isDarkMode ? 'rgba(26, 32, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)',
          color: isDarkMode ? '#e2e8f0' : '#1a202c'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid ' + (isDarkMode ? '#4a5568' : '#e2e8f0'),
            borderTop: '4px solid ' + (isDarkMode ? '#60a5fa' : '#667eea'),
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <h3 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: isDarkMode ? '#e2e8f0' : '#1a202c',
            marginBottom: '8px'
          }}>
            Chargement des Analyses
          </h3>
          <p style={{
            color: isDarkMode ? '#cbd5e0' : '#718096',
            fontSize: '16px'
          }}>
            Préparation des analyses à partir des données du Jira...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh',
        background: isDarkMode ? '#000000' : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        color: isDarkMode ? '#ffffff' : '#1a202c'
      }}>
        <div style={{
          background: isDarkMode ? 'rgba(26, 32, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)',
          color: isDarkMode ? '#e2e8f0' : '#1a202c'
        }}>
          <AlertCircle size={64} style={{ color: isDarkMode ? '#f87171' : '#ef4444', marginBottom: '24px' }} />
          <h3 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: isDarkMode ? '#e2e8f0' : '#1a202c',
            marginBottom: '12px'
          }}>
            Erreur d'Analyse
          </h3>
          <p style={{
            color: isDarkMode ? '#cbd5e0' : '#718096',
            marginBottom: '30px',
            fontSize: '16px',
            lineHeight: '1.5'
          }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button 
              onClick={fetchAnalytics}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: isDarkMode ? 'linear-gradient(135deg, #60a5fa, #3b82f6)' : 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
            >
              <RefreshCw size={18} />
              Retry
            </button>
            <button 
              onClick={handleBackToMain}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: isDarkMode ? '#4a5568' : '#718096',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = isDarkMode ? '#2d3748' : '#4a5568';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = isDarkMode ? '#4a5568' : '#718096';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
              }}
            >
              <ArrowLeft size={18} />
              Back to Main
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: isDarkMode ? '#000000' : '#ffffff',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      color: isDarkMode ? '#e2e8f0' : '#1a202c'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <div style={{
        background: isDarkMode ? 'rgba(26, 32, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid ' + (isDarkMode ? 'rgba(45, 55, 72, 0.5)' : 'rgba(255, 255, 255, 0.2)'),
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '24px',
            paddingBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <button 
                onClick={handleBackToMain}
                style={{
                  padding: '12px',
                  background: isDarkMode ? '#1a202c' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
                  borderRadius: '12px',
                  border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <ArrowLeft size={22} style={{ color: isDarkMode ? '#e2e8f0' : '#4a5568' }} />
              </button>
              <div>
                <h1 style={{
                  fontSize: '32px',
                  fontWeight: 'bold',
                  color: isDarkMode ? '#ffffff' : '#1a202c',
                  margin: '0 0 8px 0',
                  background: isDarkMode ? 'none' : 'linear-gradient(135deg, #667eea, #764ba2)',
                  WebkitBackgroundClip: isDarkMode ? 'initial' : 'text',
                  WebkitTextFillColor: isDarkMode ? 'initial' : 'transparent'
                }}>
                  Tableau de Bord Analytique
                </h1>
                <p style={{
                  color: isDarkMode ? '#cbd5e0' : '#718096',
                  fontSize: '16px',
                  fontWeight: '500',
                  margin: 0
                }}>
                  Analyses détaillées et actionnables du Jira Manager Pro
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                onClick={fetchAnalytics}
                style={{
                  padding: '12px',
                  background: isDarkMode ? '#1a202c' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
                  borderRadius: '12px',
                  border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <RefreshCw size={20} style={{ color: isDarkMode ? '#e2e8f0' : '#4a5568' }} />
              </button>
              
              <div style={{
                display: 'flex',
                background: isDarkMode ? '#1a202c' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
                borderRadius: '12px',
                padding: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0')
              }}>
                <button
                  onClick={() => setActiveView('overview')}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: activeView === 'overview' 
                      ? (isDarkMode ? 'linear-gradient(135deg, #60a5fa, #3b82f6)' : 'linear-gradient(135deg, #667eea, #764ba2)') 
                      : 'transparent',
                    color: activeView === 'overview' ? 'white' : (isDarkMode ? '#e2e8f0' : '#4a5568')
                  }}
                >
                  Vue d'ensemble
                </button>
                <button
                  onClick={() => setActiveView('trends')}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    background: activeView === 'trends' 
                      ? (isDarkMode ? 'linear-gradient(135deg, #60a5fa, #3b82f6)' : 'linear-gradient(135deg, #667eea, #764ba2)') 
                      : 'transparent',
                    color: activeView === 'trends' ? 'white' : (isDarkMode ? '#e2e8f0' : '#4a5568')
                  }}
                >
                  Tendances
                </button>
              </div>

              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                  background: isDarkMode ? '#1a202c' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: isDarkMode ? '#e2e8f0' : '#4a5568',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <option value="all">Tout le Temps</option>
                <option value="week">Dernière Semaine</option>
                <option value="month">Dernier Mois</option>
              </select>
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                style={{
                  padding: '12px',
                  background: isDarkMode ? '#1a202c' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
                  borderRadius: '12px',
                  border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  color: isDarkMode ? '#e2e8f0' : '#4a5568'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                {isDarkMode ? 'Mode Clair' : 'Mode Sombre'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '32px 24px',
        color: isDarkMode ? '#e2e8f0' : '#1a202c'
      }}>
        {activeView === 'overview' ? (
          <div style={{ 
            display: 'grid', 
            gap: '32px',
            animation: 'fadeIn 0.6s ease-out'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px'
            }}>
              <KPICard
                title="Total Tickets"
                value={metrics.totalTickets}
                subtitle="Tous le temps"
                icon={CheckCircle}
                trend={metrics.trend}
                trendValue={metrics.trendValue}
                color="#667eea"
              />
              <KPICard
                title="Haute Priorité"
                value={metrics.highPriorityCount}
                subtitle="Nécessite une attention particulière"
                icon={AlertCircle}
                color="#EF4444"
              />
              <KPICard
                title="Résolution Moyenne"
                value={metrics.avgResolutionTime.toFixed(1)}
                subtitle={"Jours pour résoudre: " + metrics.noteForAverage}
                icon={Clock}
                color="#10B981"
                unit=" jours"
              />
              <KPICard
                title="Moyenne Hebdomadaire"
                value={metrics.weeklyAverage.toFixed(1)}
                subtitle="Tickets par semaine"
                icon={Calendar}
                color="#8B5CF6"
              />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
              gap: '32px'
            }}>
              <DonutChart 
                data={analytics.priority_distribution} 
                title="Distribution des Priorités"
                centerText="Total"
              />
              <DonutChart 
                data={analytics.type_distribution} 
                title="Distribution des Types de Problèmes"
                centerText="Total"
              />
              <DonutChart 
                data={analytics.assignment_distribution} 
                title="Distribution des Assignations"
                centerText="Total"
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '32px'
            }}>
              <WeeklyTrendChart 
                data={analytics.tickets_per_week} 
                title="Tendance de Création de Tickets Hebdomadaire"
              />
              <InsightsPanel />
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '32px',
            animation: 'fadeIn 0.6s ease-out'
          }}>
            <div style={{
              background: isDarkMode ? '#000000' : 'linear-gradient(145deg, #ffffff, #f8fafc)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
              color: isDarkMode ? '#e2e8f0' : '#1a202c'
            }}>
              <h2 style={{
                fontSize: '28px',
                fontWeight: 'bold',
                color: isDarkMode ? '#e2e8f0' : '#1a202c',
                marginBottom: '32px',
                textAlign: 'center'
              }}>
                Analyse des Tendances
              </h2>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '32px'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: isDarkMode ? '#e2e8f0' : '#2d3748',
                    marginBottom: '24px'
                  }}>
                    Performances Récentes
                  </h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {analytics.tickets_per_week?.slice(-6).map((week, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px',
                        background: isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #f7fafc, #edf2f7)',
                        borderRadius: '12px',
                        border: '1px solid ' + (isDarkMode ? '#2d3748' : '#e2e8f0'),
                        transition: 'all 0.3s ease',
                        color: isDarkMode ? '#e2e8f0' : '#2d3748'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: isDarkMode ? '#e2e8f0' : '#2d3748'
                        }}>
                          {week.week}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: isDarkMode ? '#93c5fd' : '#667eea'
                          }}>
                            {week.count}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: isDarkMode ? '#cbd5e0' : '#718096',
                            fontWeight: '500'
                          }}>
                            tickets creés
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: isDarkMode ? '#e2e8f0' : '#2d3748',
                    marginBottom: '24px'
                  }}>
                    Métriques de Performance
                  </h3>
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div style={{
                      padding: '24px',
                      background: isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                      borderRadius: '12px',
                      border: '1px solid ' + (isDarkMode ? '#2d3748' : '#0ea5e9'),
                      borderLeft: '4px solid ' + (isDarkMode ? '#60a5fa' : '#0ea5e9'),
                      color: isDarkMode ? '#e2e8f0' : '#0c4a6e'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <TrendingUp size={24} style={{ color: isDarkMode ? '#60a5fa' : '#0ea5e9' }} />
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: isDarkMode ? '#e2e8f0' : '#0c4a6e'
                        }}>
                          Tendances des Volumes
                        </span>
                      </div>
                      <p style={{
                        color: isDarkMode ? '#93c5fd' : '#0369a1',
                        fontSize: '14px',
                        margin: 0,
                        lineHeight: '1.5'
                      }}>
                        {metrics.trend === 'up' ? 'Augmentation de la charge de travail détectée' : 
                         metrics.trend === 'down' ? 'La charge de travail diminue' : 
                         'Flux de travail stable'}
                      </p>
                    </div>
                    
                    <div style={{
                      padding: '24px',
                      background: isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                      borderRadius: '12px',
                      border: '1px solid ' + (isDarkMode ? '#2d3748' : '#16a34a'),
                      borderLeft: '4px solid ' + (isDarkMode ? '#34d399' : '#16a34a'),
                      color: isDarkMode ? '#e2e8f0' : '#14532d'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <Clock size={24} style={{ color: isDarkMode ? '#34d399' : '#16a34a' }} />
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: isDarkMode ? '#e2e8f0' : '#14532d'
                        }}>
                          Efficacité de Résolution
                        </span>
                      </div>
                      <p style={{
                        color: isDarkMode ? '#6ee7b7' : '#166534',
                        fontSize: '14px',
                        margin: 0,
                        lineHeight: '1.5'
                      }}>
                        {metrics.avgResolutionTime <= 3 ? 'Temps de résolution excellent' :
                         metrics.avgResolutionTime <= 7 ? 'Temps de résolution bon' :
                         'Considérer l\'optimisation du processus de résolution'}
                      </p>
                    </div>

                    <div style={{
                      padding: '24px',
                      background: isDarkMode ? '#1a202c' : 'linear-gradient(135deg, #faf5ff, #f3e8ff)',
                      borderRadius: '12px',
                      border: '1px solid ' + (isDarkMode ? '#2d3748' : '#8b5cf6'),
                      borderLeft: '4px solid ' + (isDarkMode ? '#a78bfa' : '#8b5cf6'),
                      color: isDarkMode ? '#e2e8f0' : '#581c87'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '12px'
                      }}>
                        <PieChart size={24} style={{ color: isDarkMode ? '#a78bfa' : '#8b5cf6' }} />
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: isDarkMode ? '#e2e8f0' : '#581c87'
                        }}>
                          Focus Area
                        </span>
                      </div>
                      <p style={{
                        color: isDarkMode ? '#c4b5fd' : '#6b21a8',
                        fontSize: '14px',
                        margin: 0,
                        lineHeight: '1.5'
                      }}>
                        {metrics.mostCommonType} tickets sont très fréquents - il est conseillé d'envisager une optimisation des processus.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}