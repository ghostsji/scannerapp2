import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

export default function MainScreen({ route, navigation }) {
    const { user } = route.params;
    const [pickNote, setPickNote] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientCode, setClientCode] = useState('');

    const handleStartScanning = () => {
        if (pickNote.trim() && (clientName.trim() || clientCode.trim())) {
            navigation.navigate('Camera', {
                user,
                pickNote,
                client: { name: clientName, code: clientCode }
            });
        } else {
            Alert.alert('Error', 'Please fill in pick note and client details');
        }
    };

    const handleViewGallery = () => {
        navigation.navigate('Gallery', { user });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome, {user.name} {user.surname}</Text>
            <TextInput
                style={styles.input}
                placeholder="Pick Note Number"
                value={pickNote}
                onChangeText={setPickNote}
            />
            <TextInput
                style={styles.input}
                placeholder="Client Name"
                value={clientName}
                onChangeText={setClientName}
            />
            <TextInput
                style={styles.input}
                placeholder="Client Code"
                value={clientCode}
                onChangeText={setClientCode}
            />
            <TouchableOpacity style={styles.button} onPress={handleStartScanning}>
                <Text style={styles.buttonText}>Start Scanning</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleViewGallery}>
                <Text style={styles.buttonText}>View Gallery</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 30,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        marginBottom: 15,
        borderRadius: 5,
        backgroundColor: '#fff',
    },
    button: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
        marginBottom: 10,
    },
    secondaryButton: {
        backgroundColor: '#34C759',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
