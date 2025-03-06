// ProfileButton.tsx
import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSelector } from 'react-redux'
import { getCurrentUser } from 'app/store/authSlice'
import { AutoImage } from 'app/components'

const ProfileButton: React.FC = () => {
  const navigation = useNavigation()
  const currentUser = useSelector(getCurrentUser)
  return (
    <Pressable
      style={styles.profileButton}
      onPress={() => navigation.navigate('Profile')}
    >
      {currentUser?.avatar ? (
        <AutoImage source={{ uri: currentUser.avatar }} style={styles.avatar} />
      ) : (
        <Text style={styles.profileText}>Profile</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  profileButton: {
    marginRight: 15,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  profileText: {
    fontSize: 16,
    color: '#3498db',
  },
})

export default ProfileButton
