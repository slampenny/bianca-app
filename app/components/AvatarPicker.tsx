import React, { useState, useEffect } from 'react';
import { Platform, Image, Button, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface AvatarPickerProps {
    initialAvatar: string | null;
    onAvatarChanged: (uri: string) => void;
}

const AvatarPicker: React.FC<AvatarPickerProps> = ({ initialAvatar, onAvatarChanged }) => {
    const [image, setImage] = useState<string | null>(null);

    useEffect(() => {
      setImage(initialAvatar);
  }, [initialAvatar]);

  const pickImage = async () => {
    let result;
    // Differentiating functionality based on platform
    if (Platform.OS === 'web') {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    }

    if (!result.canceled) {
        const uri = result.assets[0].uri;
        setImage(uri);
        onAvatarChanged(uri);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {image && <Image source={{ uri: image }} style={{ width: 200, height: 200 }} />}
      <Button title="Select Image" onPress={pickImage} />
    </View>
  );
};

export default AvatarPicker;
