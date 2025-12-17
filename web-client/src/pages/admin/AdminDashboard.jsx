import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Users, UserCheck, UserX, Activity } from 'lucide-react';
import api from '@/services/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // In a real app, we might have a specific stats endpoint
        // For now, we'll fetch users and calculate
        const response = await api.get('/admin/users');
        const users = response.data.data.users;
        
        setStats({
          totalUsers: users.length,
          activeUsers: users.filter(u => u.isActive).length,
          inactiveUsers: users.filter(u => !u.isActive).length,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { name: 'Total Users', stat: stats.totalUsers, icon: Users, color: 'bg-blue-500' },
    { name: 'Active Users', stat: stats.activeUsers, icon: UserCheck, color: 'bg-green-500' },
    { name: 'Inactive Users', stat: stats.inactiveUsers, icon: UserX, color: 'bg-red-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {statCards.map((item) => (
            <div key={item.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`rounded-md p-3 ${item.color}`}>
                      <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{item.name}</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {loading ? '...' : item.stat}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">System Health</h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center text-green-600">
              <Activity className="h-5 w-5 mr-2" />
              <span className="font-medium">All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
