import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Input from '../components/Input';
import Button from '../components/Button';

export default function LoginScreen({ navigation }) {
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');

    const handleLogin = () => {
        if (name.trim() && surname.trim()) {
            navigation.navigate('Main', { user: { name: name.trim(), surname: surname.trim() } });
        } else {
            Alert.alert('Error', 'Please enter your name and surname');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Login</Text>
            <Input
                placeholder="Name"
                value={name}
                onChangeText={setName}
            />
            <Input
                placeholder="Surname"
                value={surname}
                onChangeText={setSurname}
            />
            <Button title="Login" onPress={handleLogin} />
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
});
