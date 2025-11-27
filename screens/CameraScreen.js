import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CameraScreen({ route, navigation }) {
    const { user, pickNote, client } = route.params;
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [description, setDescription] = useState('');
    const [quantity, setQuantity] = useState('');

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 1,
            });

            if (!result.canceled) {
                setSelectedImage(result.assets[0]);
                setModalVisible(true);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const saveImage = async () => {
        if (!description.trim() || !quantity.trim()) {
            Alert.alert('Error', 'Please fill in description and quantity');
            return;
        }

        try {
            // Save metadata to AsyncStorage
            const imageData = {
                id: Date.now().toString(),
                uri: selectedImage.uri,
                user: `${user.name} ${user.surname}`,
                pickNote,
                client,
                description: description.trim(),
                quantity: quantity.trim(),
                timestamp: new Date().toISOString(),
            };

            const existingImages = await AsyncStorage.getItem('images');
            const images = existingImages ? JSON.parse(existingImages) : [];
            images.push(imageData);
            await AsyncStorage.setItem('images', JSON.stringify(images));

            Alert.alert('Success', 'Image saved successfully');
            setModalVisible(false);
            setSelectedImage(null);
            setDescription('');
            setQuantity('');
        } catch (error) {
            Alert.alert('Error', 'Failed to save image');
        }
    };

    const cancelSave = () => {
        setModalVisible(false);
        setSelectedImage(null);
        setDescription('');
        setQuantity('');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Camera Screen</Text>
            <Text style={styles.subtitle}>Select an image from your gallery</Text>

            <View style={styles.controls}>
                <TouchableOpacity style={styles.captureButton} onPress={pickImage}>
                    <Text style={styles.captureButtonText}>Select Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.captureButton, styles.secondaryButton]} onPress={() => navigation.goBack()}>
                    <Text style={styles.captureButtonText}>Back</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={modalVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>Image Details</Text>
                    {selectedImage && <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />}
                    <TextInput
                        style={styles.input}
                        placeholder="Item Description/Code"
                        value={description}
                        onChangeText={setDescription}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="numeric"
                    />
                    <View style={styles.modalButtons}>
                        <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveImage}>
                            <Text style={styles.modalButtonText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={cancelSave}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        color: '#666',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    captureButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 50,
        width: 120,
        alignItems: 'center',
    },
    secondaryButton: {
        backgroundColor: '#FF3B30',
    },
    captureButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    previewImage: {
        width: '100%',
        height: 200,
        marginBottom: 20,
        borderRadius: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        marginBottom: 15,
        borderRadius: 5,
        backgroundColor: '#fff',
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    modalButton: {
        padding: 15,
        borderRadius: 5,
        width: 120,
        alignItems: 'center',
    },
    saveButton: {
        backgroundColor: '#34C759',
    },
    cancelButton: {
        backgroundColor: '#FF3B30',
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
