import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const Button = ({ title, onPress, variant = 'primary', style }) => {
    const buttonStyle = [styles.button, style];
    const textStyle = [styles.buttonText];

    if (variant === 'secondary') {
        buttonStyle.push(styles.secondaryButton);
    } else if (variant === 'danger') {
        buttonStyle.push(styles.dangerButton);
    }

    return (
        <TouchableOpacity style={buttonStyle} onPress={onPress}>
            <Text style={textStyle}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
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
    dangerButton: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});

export default Button;
=======
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

const Button = ({ title, onPress, variant = 'primary', style, disabled = false }) => {
    const buttonStyle = [styles.button, style];
    const textStyle = [styles.buttonText];

    if (variant === 'secondary') {
        buttonStyle.push(styles.secondaryButton);
    } else if (variant === 'danger') {
        buttonStyle.push(styles.dangerButton);
    } else if (variant === 'outline') {
        buttonStyle.push(styles.outlineButton);
        textStyle.push(styles.outlineButtonText);
    }

    if (disabled) {
        buttonStyle.push(styles.disabledButton);
        textStyle.push(styles.disabledButtonText);
    }

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <Text style={textStyle}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        backgroundColor: theme.colors.primary,
        padding: theme.spacing.medium,
        borderRadius: theme.borderRadius.medium,
        alignItems: 'center',
        marginBottom: theme.spacing.small,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    secondaryButton: {
        backgroundColor: theme.colors.secondary,
    },
    dangerButton: {
        backgroundColor: theme.colors.danger,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary,
    },
    outlineButtonText: {
        color: theme.colors.primary,
    },
    disabledButton: {
        backgroundColor: theme.colors.border,
        elevation: 0,
        shadowOpacity: 0,
    },
    disabledButtonText: {
        color: theme.colors.textSecondary,
    },
    buttonText: {
        color: '#fff',
        fontSize: theme.fontSize.medium,
        fontWeight: 'bold',
    },
});

export default Button;
