import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Excepción capturada en la interfaz:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center border border-red-100">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Se produjo un error inesperado</h2>
            <p className="text-sm text-gray-600 mb-4">
              La aplicación encontró un problema inesperado al renderizar esta sección.
            </p>
            {this.state.error?.message && (
              <div className="bg-gray-50 text-left p-3 rounded text-xs font-mono text-gray-700 mb-4 overflow-auto max-h-32 border">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-sm"
            >
              Reintentar y Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
