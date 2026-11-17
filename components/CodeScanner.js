import React, { useRef } from 'react';
import { Modal, View, Text, StyleSheet, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Button from './Button';
import { theme } from '../constants/theme';

// The camera barcode scanner, full screen. Reads the 2D codes on supplier
// reel labels (Data Matrix, QR) and ordinary barcodes. The scanned text is
// passed on untouched: reel labels separate their fields with control
// characters that Tracklab needs to read the part, quantity and lot.

const TYPES = ['datamatrix', 'qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a', 'itf14', 'pdf417'];

export default function CodeScanner({ visible, onCode, onClose, hint }) {
    const [permission, requestPermission] = useCameraPermissions();
    const done = useRef(false);

    const scanned = ({ data }) => {
        if (done.current || !data) return;
        done.current = true;
        Vibration.vibrate(60);
        onCode(String(data));
    };

    return (
        <Modal visible={visible} animationType="slide" onShow={() => { done.current = false; }} onRequestClose={onClose}>
            <View style={styles.container}>
                {!permission ? (
                    <View style={styles.center}><Text style={styles.message}>Checking the camera…</Text></View>
                ) : !permission.granted ? (
                    <View style={styles.center}>
                        <Text style={styles.message}>
                            {permission.canAskAgain
                                ? 'Tracklab Scan needs the camera to scan labels.'
                                : 'Camera access was refused. Allow it for Tracklab Scan in the phone\'s settings, or type the code instead.'}
                        </Text>
                        {permission.canAskAgain ? <Button title="Allow the camera" onPress={requestPermission} style={styles.wide} /> : null}
                    </View>
                ) : (
                    <View style={styles.cameraWrap}>
                        <CameraView
                            style={StyleSheet.absoluteFill}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: TYPES }}
                            onBarcodeScanned={scanned}
                        />
                        <View style={styles.frame} pointerEvents="none" />
                    </View>
                )}
                <View style={styles.footer}>
                    <Text style={styles.hint}>{hint || 'Hold the label inside the frame'}</Text>
                    <Button title="Close camera" onPress={onClose} variant="secondary" />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    cameraWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    frame: { width: '80%', height: 200, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 14 },
    center: { flex: 1, justifyContent: 'center', padding: 28 },
    message: { color: '#fff', fontSize: theme.fontSize.medium, textAlign: 'center', marginBottom: 20 },
    wide: { alignSelf: 'stretch' },
    footer: { padding: 18, paddingBottom: 30, backgroundColor: '#000' },
    hint: { color: '#fff', opacity: 0.8, textAlign: 'center', marginBottom: 12, fontSize: theme.fontSize.small },
});
