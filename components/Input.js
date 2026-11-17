import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

const Input = ({ label, style, ...props }) => (
    <View style={styles.wrap}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <TextInput
            style={[styles.input, style]}
            placeholderTextColor={theme.colors.textSecondary}
            accessibilityLabel={label || props.placeholder}
            {...props}
        />
    </View>
);

const styles = StyleSheet.create({
    wrap: { marginBottom: theme.spacing.medium },
    label: { color: theme.colors.textSecondary, fontSize: theme.fontSize.small, fontWeight: 'bold', marginBottom: 5 },
    input: {
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderRadius: theme.borderRadius.medium,
        backgroundColor: theme.colors.card,
        color: theme.colors.text,
        fontSize: theme.fontSize.medium,
    },
});

export default Input;
