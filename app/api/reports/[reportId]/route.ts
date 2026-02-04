import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
): Promise<NextResponse> {
  try {
    const { reportId } = await params;
    
    // Walidacja parametru
    if (!reportId || reportId.includes('..') || reportId.includes('/')) {
      return NextResponse.json(
        { error: 'Nieprawidłowy ID raportu' },
        { status: 400 }
      );
    }

    // Tutaj w przyszłości będzie obsługa pobierania pliku
    // Na razie zwracamy błąd (raport jest generowany w endpoincie /process)
    return NextResponse.json(
      { error: 'Raport jest dostępny bezpośrednio z odpowiedzi /process' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Błąd podczas pobierania raportu:', error);
    return NextResponse.json(
      { error: 'Nie udało się pobrać raportu' },
      { status: 500 }
    );
  }
}
