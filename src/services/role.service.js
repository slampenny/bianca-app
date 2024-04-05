const getRoleById = (roleId) => {
  if (roleId === 'user') {
    return {
      id: 'user',
      name: 'User',
      permissions: [],
    };
  }
  if (roleId === 'caregiver') {
    return {
      id: 'caregiver',
      name: 'Caregiver',
      permissions: [],
    };
  }
  if (roleId === 'admin') {
    return {
      id: 'admin',
      name: 'Admin',
      permissions: ['getUsers', 'manageUsers'],
    };
  }
  return {
    id: 'public',
    name: 'Public',
    permissions: [],
  };
};

module.exports = {
  getRoleById,
};
