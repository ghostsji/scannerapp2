import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../constants/theme';

const Button = ({ title, onPress, variant = 'primary', style, disabled = false, loading = false, color }) => {
    const buttonStyle = [styles.button, style];
    const textStyle = [styles.buttonText];

    if (variant === 'secondary') {
        buttonStyle.push(styles.secondaryButton);
        textStyle.push(styles.secondaryText);
    } else if (variant === 'danger') {
        buttonStyle.push(styles.dangerButton);
        textStyle.push(styles.lightText);
    } else if (variant === 'outline') {
        buttonStyle.push(styles.outlineButton);
        textStyle.push(styles.outlineButtonText);
    }
    if (color) {
        buttonStyle.push({ backgroundColor: color });
        textStyle.push(color === theme.colors.in ? styles.lightText : null);
    }
    if (disabled || loading) buttonStyle.push(styles.disabledButton);

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={title}
        >
            {loading ? <ActivityIndicator color={theme.colors.text} /> : <Text style={textStyle}>{title}</Text>}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 15,
        paddingHorizontal: theme.spacing.medium,
        borderRadius: theme.borderRadius.medium,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: theme.spacing.small,
        minHeight: 52,
    },
    secondaryButton: { backgroundColor: theme.colors.cardHigh },
    secondaryText: { color: theme.colors.text },
    dangerButton: { backgroundColor: theme.colors.danger },
    lightText: { color: '#fff' },
    outlineButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border },
    outlineButtonText: { color: theme.colors.text },
    disabledButton: { opacity: 0.45 },
    buttonText: { color: theme.colors.onPrimary, fontSize: theme.fontSize.medium, fontWeight: 'bold' },
});

export default Button;
