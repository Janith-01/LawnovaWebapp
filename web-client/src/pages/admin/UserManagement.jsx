import React, { useEffect, useState } from 'react';
import {
  Search,
  UserPlus,
  Shield,
  Users,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Edit2,
  Trash2,
  MoreVertical,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// Deprecated as a standalone route page: retained for rollback/reference only.
// Canonical admin UI is `src/admin/AdminConsole.jsx` mounted on `/admin/*`.

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [deleteConfirmPending, setDeleteConfirmPending] = useState(null); // Stores userId waiting for confirmation

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data.data.users || []);
      toast.success('Users loaded successfully');
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to fetch users');
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
      toast.success(`User ${action}d successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || `Failed to ${action} user`);
    }
  };

  const handleDeleteUser = async (userId) => {
    // Toast-based confirmation (double-click pattern)
    if (deleteConfirmPending !== userId) {
      setDeleteConfirmPending(userId);
      toast.warning('Click delete again to confirm. This action cannot be undone.');

      // Reset confirmation state after 3 seconds
      setTimeout(() => setDeleteConfirmPending(null), 3000);
      return;
    }

    // User confirmed - proceed with deletion
    setDeleteConfirmPending(null);

    try {
      await api.delete(`/api/admin/users/${userId}`);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete user');
    }
  };

  const filteredUsers = users
    .filter(user => {
      if (filter === 'active') return user.isActive;
      if (filter === 'inactive') return !user.isActive;
      return true;
    })
    .filter(user => {
      if (roleFilter === 'all') return true;
      return user.role === roleFilter;
    })
    .filter(user => {
      const searchLower = searchTerm.toLowerCase();
      const fullName = user.fullName || '';
      return (
        fullName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    });

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    admins: users.filter(u => u.role === 'admin').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="mt-1 text-sm text-gray-600">Manage user accounts and permissions</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={fetchUsers}
                disabled={loading}
                className="text-gray-600 hover:text-purple-600"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg"
                onClick={() => setShowUserModal(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.active}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive Users</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{stats.inactive}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <UserX className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Administrators</p>
                <p className="text-3xl font-bold text-indigo-600 mt-2">{stats.admins}</p>
              </div>
              <div className="bg-indigo-100 rounded-full p-3">
                <Shield className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-gray-200 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilter('all')}
                className={cn(
                  filter === 'all'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'text-gray-600 hover:text-purple-600'
                )}
              >
                All Users
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'ghost'}
                onClick={() => setFilter('active')}
                className={cn(
                  filter === 'active'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'text-gray-600 hover:text-green-600'
                )}
              >
                Active
              </Button>
              <Button
                variant={filter === 'inactive' ? 'default' : 'ghost'}
                onClick={() => setFilter('inactive')}
                className={cn(
                  filter === 'inactive'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'text-gray-600 hover:text-red-600'
                )}
              >
                Inactive
              </Button>
            </div>

            {/* Role Filter */}
            <div className="flex gap-2">
              <Button
                variant={roleFilter === 'all' ? 'default' : 'ghost'}
                onClick={() => setRoleFilter('all')}
                className={cn(
                  roleFilter === 'all'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                )}
              >
                All Roles
              </Button>
              <Button
                variant={roleFilter === 'admin' ? 'default' : 'ghost'}
                onClick={() => setRoleFilter('admin')}
                className={cn(
                  roleFilter === 'admin'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                )}
              >
                <Shield className="h-4 w-4 mr-1" />
                Admin
              </Button>
              <Button
                variant={roleFilter === 'student' ? 'default' : 'ghost'}
                onClick={() => setRoleFilter('student')}
                className={cn(
                  roleFilter === 'student'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'text-gray-600 hover:text-indigo-600'
                )}
              >
                Student
              </Button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-purple-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-purple-600 animate-spin mb-2" />
                        <p className="text-gray-600">Loading users...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="h-12 w-12 text-gray-400 mb-2" />
                        <p className="text-gray-600 font-medium">No users found</p>
                        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-purple-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {user.fullName?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-semibold text-gray-900">
                              {user.fullName || 'No name'}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-3 py-1 inline-flex items-center text-xs font-semibold rounded-full",
                          user.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-purple-100 text-purple-800'
                        )}>
                          {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-3 py-1 inline-flex items-center text-xs font-semibold rounded-full",
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        )}>
                          {user.isActive ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                            : 'Never'
                          }
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user._id, user.isActive)}
                            className={cn(
                              "hover:bg-purple-50",
                              user.isActive ? "text-red-600 hover:text-red-700" : "text-green-600 hover:text-green-700"
                            )}
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(user._id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-center text-sm text-gray-600">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
