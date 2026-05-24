import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  ReceiptText,
  ScanLine,
  ShieldCheck,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Image, View } from 'react-native';

import {
  Card,
  IconCircle,
  PressableScale,
  PrimaryButton,
  ScreenContainer,
  Text,
} from '@/components';
import {
  confirmBillPaymentFromInvoice,
  processInvoiceImage,
  type ProcessInvoiceResponse,
} from '@/services/api';
import { useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

const IMAGE_SOURCE = {
  CAMERA: 'camera',
  LIBRARY: 'library',
} as const;

type InvoiceImageSource = (typeof IMAGE_SOURCE)[keyof typeof IMAGE_SOURCE];

type PickedInvoiceImage = {
  uri: string;
  base64: string;
  mimeType: string;
  fileName?: string | null;
  source: InvoiceImageSource;
  width: number;
  height: number;
};

function InvoiceField({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt, gap: 4 }}>
      <Text variant="micro" tone="muted">
        {label}
      </Text>
      <Text variant="bodyStrong" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function InvoicePaymentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [selectedImage, setSelectedImage] = useState<PickedInvoiceImage | null>(null);
  const [invoice, setInvoice] = useState<ProcessInvoiceResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [paying, setPaying] = useState(false);

  const extracted = invoice?.extracted;
  const canPay = Boolean(
    invoice && extracted?.provider && extracted.amount && extracted.reference && !analyzing && !paying
  );

  const analyzeImage = async (image: PickedInvoiceImage) => {
    setAnalyzing(true);
    setInvoice(null);
    try {
      const result = await processInvoiceImage({
        imageBase64: image.base64,
        mimeType: image.mimeType,
        fileName: image.fileName,
        source: image.source,
      });
      setInvoice(result);
    } catch (error) {
      Alert.alert(
        'No pudimos leer la factura',
        error instanceof Error ? error.message : 'Intenta con una foto más clara.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePickImage = async (source: InvoiceImageSource) => {
    const permission = source === IMAGE_SOURCE.CAMERA
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permiso necesario',
        source === IMAGE_SOURCE.CAMERA
          ? 'Necesitamos acceso a la cámara para tomar la foto de la factura.'
          : 'Necesitamos acceso a tus fotos para elegir la factura.'
      );
      return;
    }

    const options = {
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.72,
      base64: true,
    } satisfies ImagePicker.ImagePickerOptions;

    const result = source === IMAGE_SOURCE.CAMERA
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert('Imagen no disponible', 'No pudimos obtener la imagen en base64 para analizarla. Intenta de nuevo.');
      return;
    }

    const nextImage: PickedInvoiceImage = {
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName,
      source,
      width: asset.width,
      height: asset.height,
    };

    setSelectedImage(nextImage);
    await analyzeImage(nextImage);
  };

  const handleConfirmPayment = async () => {
    if (!invoice) return;

    setPaying(true);
    try {
      const result = await confirmBillPaymentFromInvoice(invoice);
      Alert.alert(
        'Pago exitoso',
        `Pagaste ${result.payment.provider} por ${formatMoney(result.payment.amount)}. Tu Pasaporte sumó +${result.passportUpdate.pointsAdded} puntos.`,
        [
          { text: 'Cerrar' },
          { text: 'Ver movimientos', onPress: () => router.replace('/(tabs)/movimientos') },
        ]
      );
    } catch (error) {
      Alert.alert(
        'No pudimos confirmar el pago',
        error instanceof Error ? error.message : 'Revisa los datos extraídos e intenta de nuevo.'
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <PressableScale
          onPress={() => router.back()}
          haptic="light"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.surfaceAlt,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
          }}
        >
          <ArrowLeft size={19} color={theme.colors.text} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text variant="h2">Pago por foto</Text>
          <Text variant="bodySmall" tone="muted">
            Escanea una factura y deja que la IA prepare el pago.
          </Text>
        </View>
      </View>

      <Card delay={0} padded style={{ padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconCircle Icon={ScanLine} tone="primary" size={42} />
          <View style={{ flex: 1 }}>
            <Text variant="h3">OCR + IA financiera</Text>
            <Text variant="bodySmall" tone="muted">
              Detectamos proveedor, valor, referencia y vencimiento antes de pagar.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PrimaryButton
            label="Tomar foto"
            icon={Camera}
            loading={analyzing && selectedImage?.source === IMAGE_SOURCE.CAMERA}
            disabled={analyzing || paying}
            style={{ flex: 1 }}
            onPress={() => handlePickImage(IMAGE_SOURCE.CAMERA)}
          />
          <PrimaryButton
            label="Galería"
            icon={ImageIcon}
            variant="secondary"
            loading={analyzing && selectedImage?.source === IMAGE_SOURCE.LIBRARY}
            disabled={analyzing || paying}
            style={{ flex: 1 }}
            onPress={() => handlePickImage(IMAGE_SOURCE.LIBRARY)}
          />
        </View>
      </Card>

      {selectedImage ? (
        <Card delay={80} padded style={{ padding: 14, gap: 10 }}>
          <Image
            source={{ uri: selectedImage.uri }}
            style={{ width: '100%', height: 210, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceAlt }}
            resizeMode="cover"
          />
          <Text variant="micro" tone="muted">
            {selectedImage.fileName || 'Factura capturada'} · {selectedImage.width}×{selectedImage.height}
          </Text>
        </Card>
      ) : null}

      {analyzing ? (
        <Card delay={120} padded style={{ padding: 18, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconCircle Icon={ScanLine} tone="primary" size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Leyendo factura…</Text>
              <Text variant="bodySmall" tone="muted">
                La IA está extrayendo los datos críticos para el pago.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {invoice && extracted ? (
        <Card delay={160} padded style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconCircle Icon={extracted.requiresReview ? AlertTriangle : CheckCircle2} tone={extracted.requiresReview ? 'warn' : 'success'} size={38} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Factura detectada</Text>
              <Text variant="bodySmall" tone="muted">
                Confianza {Math.round(extracted.confidence * 100)}% · Modelo {invoice.model}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InvoiceField label="Proveedor" value={extracted.provider || 'Requiere revisión'} />
            <InvoiceField label="Valor" value={extracted.amount ? formatMoney(extracted.amount) : 'Requiere revisión'} />
            <InvoiceField label="Referencia" value={extracted.reference || 'Requiere revisión'} />
            <InvoiceField label="Vence" value={extracted.dueDate || 'Sin fecha'} />
            <InvoiceField label="Categoría" value={extracted.category || 'Servicios públicos'} />
            <InvoiceField label="Concepto" value={extracted.concept || 'Factura por pagar'} />
          </View>

          {invoice.usedFallback || extracted.requiresReview || extracted.warnings.length > 0 ? (
            <View style={{ padding: 12, borderRadius: theme.radii.lg, backgroundColor: theme.colors.warnSoft, gap: 6 }}>
              <Text variant="caption" tone="warn">
                Revisión recomendada
              </Text>
              {(extracted.warnings.length ? extracted.warnings : ['La extracción usó fallback o tiene baja confianza.']).map((warning) => (
                <Text key={warning} variant="micro" tone="muted">
                  • {warning}
                </Text>
              ))}
            </View>
          ) : null}

          <PrimaryButton
            label={paying ? 'Confirmando pago…' : 'Confirmar pago rápido'}
            icon={ShieldCheck}
            loading={paying}
            disabled={!canPay}
            onPress={handleConfirmPayment}
          />
          <PrimaryButton
            label="Analizar otra factura"
            icon={ReceiptText}
            variant="secondary"
            disabled={analyzing || paying}
            onPress={() => {
              setInvoice(null);
              setSelectedImage(null);
            }}
          />
        </Card>
      ) : null}
    </ScreenContainer>
  );
}
