import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../components/Button';
import Input from '../components/Input';

export default function GalleryScreen({ route, navigation }) {
    const { user } = route.params;
    const [images, setImages] = useState([]);
    const [filteredImages, setFilteredImages] = useState([]);
    const [filterPickNote, setFilterPickNote] = useState('');
    const [filterUser, setFilterUser] = useState('');
    const [filterClient, setFilterClient] = useState('');

    useEffect(() => {
        loadImages();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [images, filterPickNote, filterUser, filterClient]);

    const loadImages = async () => {
        try {
            const storedImages = await AsyncStorage.getItem('images');
            if (storedImages) {
                const parsedImages = JSON.parse(storedImages);
                setImages(parsedImages);
            }
        } catch (error) {
            console.error('Error loading images:', error);
        }
    };

    const applyFilters = () => {
        let filtered = images;

        if (filterPickNote.trim()) {
            filtered = filtered.filter(img => img.pickNote.toLowerCase().includes(filterPickNote.toLowerCase()));
        }

        if (filterUser.trim()) {
            filtered = filtered.filter(img => img.user.toLowerCase().includes(filterUser.toLowerCase()));
        }

        if (filterClient.trim()) {
            filtered = filtered.filter(img =>
                img.client.name.toLowerCase().includes(filterClient.toLowerCase()) ||
                img.client.code.toLowerCase().includes(filterClient.toLowerCase())
            );
        }

        setFilteredImages(filtered);
    };

    const renderImage = ({ item }) => (
        <View style={styles.imageContainer}>
            <Image source={{ uri: item.uri }} style={styles.image} />
            <View style={styles.imageInfo}>
                <Text style={styles.infoText}>User: {item.user}</Text>
                <Text style={styles.infoText}>Pick Note: {item.pickNote}</Text>
                <Text style={styles.infoText}>Client: {item.client.name || item.client.code}</Text>
                <Text style={styles.infoText}>Description: {item.description}</Text>
                <Text style={styles.infoText}>Quantity: {item.quantity}</Text>
                <Text style={styles.infoText}>Date: {new Date(item.timestamp).toLocaleString()}</Text>
            </View>
        </View>
    );

    const clearFilters = () => {
        setFilterPickNote('');
        setFilterUser('');
        setFilterClient('');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Gallery</Text>

            <View style={styles.filterContainer}>
                <Input
                    placeholder="Filter by Pick Note"
                    value={filterPickNote}
                    onChangeText={setFilterPickNote}
                />
                <Input
                    placeholder="Filter by User"
                    value={filterUser}
                    onChangeText={setFilterUser}
                />
                <Input
                    placeholder="Filter by Client"
                    value={filterClient}
                    onChangeText={setFilterClient}
                />
                <Button title="Clear Filters" onPress={clearFilters} variant="danger" />
            </View>

            <FlatList
                data={filteredImages}
                renderItem={renderImage}
                keyExtractor={(item) => item.id}
                style={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No images found</Text>}
            />

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        padding: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    filterContainer: {
        marginBottom: 20,
    },
    filterInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 10,
        marginBottom: 10,
        borderRadius: 5,
        backgroundColor: '#fff',
    },

    list: {
        flex: 1,
    },
    imageContainer: {
        backgroundColor: '#fff',
        marginBottom: 15,
        borderRadius: 10,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    image: {
        width: '100%',
        height: 200,
    },
    imageInfo: {
        padding: 15,
    },
    infoText: {
        fontSize: 14,
        marginBottom: 5,
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 18,
        color: '#999',
        marginTop: 50,
    },

});
