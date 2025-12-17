import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import api from '@/services/api';
import { Search, UserPlus, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data.data.users);
    } catch (error) {
      toast.error('Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleActive = async (userId, isActive) => {
    const action = isActive ? 'deactivate' : 'activate';
    try {
      await api.post(`/api/admin/users/${userId}/${action}`);
      toast.success(`User ${action}d successfully.`);
      fetchUsers(); // Re-fetch to update the list
    } catch (error) {
      toast.error(`Failed to ${action} user.`);
    }
  };

  const filteredUsers = users
    .filter(user => {
      if (filter === 'active') return user.isActive;
      if (filter === 'inactive') return !user.isActive;
      return true;
    })
    .filter(user =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="p-4 border-b">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>All</Button>
                <Button variant={filter === 'active' ? 'secondary' : 'ghost'} onClick={() => setFilter('active')}>Active</Button>
                <Button variant={filter === 'inactive' ? 'secondary' : 'ghost'} onClick={() => setFilter('inactive')}>Inactive</Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-8 text-gray-500">Loading users...</td></tr>
                ) : filteredUsers.map((user) => (
                  <tr key={user._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{user.role}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {/* Dropdown menu for actions would go here */}
                      <Button variant="ghost" size="icon" onClick={() => handleToggleActive(user._id, user.isActive)}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;
