import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

const Input = ({ placeholder, value, onChangeText, keyboardType = 'default', secureTextEntry = false, style }) => {
    return (
        <TextInput
            style={[styles.input, style]}
            placeholder={placeholder}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
        />
    );
};

const styles = StyleSheet.create({
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        marginBottom: 15,
        borderRadius: 5,
        backgroundColor: '#fff',
        fontSize: 16,
    },
});

export default Input;
