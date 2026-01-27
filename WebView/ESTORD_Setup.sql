-- ============================================
-- Script de creación de tablas y datos mock
-- para el módulo ESTORD (Estado de Órdenes)
-- ============================================

-- Eliminar tablas si existen (en orden inverso por FK)
IF OBJECT_ID('OrdenesDetalle', 'U') IS NOT NULL DROP TABLE OrdenesDetalle;
IF OBJECT_ID('Ordenes', 'U') IS NOT NULL DROP TABLE Ordenes;
IF OBJECT_ID('Especies', 'U') IS NOT NULL DROP TABLE Especies;


-- ============================================
-- Tabla: Especies (instrumentos financieros)
-- ============================================
CREATE TABLE Especies (
    EspecieId INT PRIMARY KEY,
    Codigo VARCHAR(20) NOT NULL,
    Descripcion VARCHAR(200) NOT NULL,
    Tipo VARCHAR(50),
    Moneda VARCHAR(10) DEFAULT 'ARS'
);

-- ============================================
-- Tabla: Ordenes
-- ============================================
CREATE TABLE Ordenes (
    NroOrden INT PRIMARY KEY,
    TipoOrden VARCHAR(20) NOT NULL,
    ClienteId CHAR(10) NOT NULL,
    FechaOrden DATETIME NOT NULL,
    Estado VARCHAR(20) NOT NULL,
    Monto DECIMAL(18,2) NOT NULL,
    Usuario VARCHAR(50) NOT NULL,
    Observaciones VARCHAR(500),
    CONSTRAINT FK_Ordenes_Clientes FOREIGN KEY (ClienteId) REFERENCES Clientes(Codigo)
);

-- ============================================
-- Tabla: OrdenesDetalle
-- ============================================
CREATE TABLE OrdenesDetalle (
    NroOrden INT NOT NULL,
    NroItem INT NOT NULL,
    EspecieId INT NOT NULL,
    Cantidad DECIMAL(18,4) NOT NULL,
    Precio DECIMAL(18,4) NOT NULL,
    Importe DECIMAL(18,2) NOT NULL,
    Comision DECIMAL(18,2) DEFAULT 0,
    CONSTRAINT PK_OrdenesDetalle PRIMARY KEY (NroOrden, NroItem),
    CONSTRAINT FK_OrdenesDetalle_Ordenes FOREIGN KEY (NroOrden) REFERENCES Ordenes(NroOrden),
    CONSTRAINT FK_OrdenesDetalle_Especies FOREIGN KEY (EspecieId) REFERENCES Especies(EspecieId)
);

-- ============================================
-- Datos Mock: Especies
-- ============================================
INSERT INTO Especies (EspecieId, Codigo, Descripcion, Tipo, Moneda) VALUES
(1, 'GGAL', 'Grupo Financiero Galicia S.A.', 'Accion', 'ARS'),
(2, 'YPF', 'YPF S.A.', 'Accion', 'ARS'),
(3, 'PAMP', 'Pampa Energia S.A.', 'Accion', 'ARS'),
(4, 'YPFD', 'YPF S.A. ADR', 'ADR', 'USD'),
(5, 'AL30', 'Bonos Argentina 2030', 'Bono', 'USD'),
(6, 'GD30', 'Global 2030', 'Bono', 'USD'),
(7, 'TX26', 'Boncer 2026', 'Bono', 'ARS'),
(8, 'METR', 'Metrogas S.A.', 'Accion', 'ARS'),
(9, 'SUPV', 'Grupo Supervielle S.A.', 'Accion', 'ARS'),
(10, 'CEPU', 'Central Puerto S.A.', 'Accion', 'ARS'),
(11, 'BBAR', 'Banco BBVA Argentina S.A.', 'Accion', 'ARS'),
(12, 'TECO2', 'Telecom Argentina S.A.', 'Accion', 'ARS'),
(13, 'LEDE', 'Ledesma S.A.', 'Accion', 'ARS'),
(14, 'CRES', 'Cresud S.A.', 'Accion', 'ARS'),
(15, 'TXAR', 'Ternium Argentina S.A.', 'Accion', 'ARS');

-- ============================================
-- Datos Mock: Ordenes (últimos 30 días)
-- ============================================
INSERT INTO Ordenes (NroOrden, TipoOrden, ClienteId, FechaOrden, Estado, Monto, Usuario, Observaciones) VALUES
-- Órdenes de hoy
(1001, 'Compra', '1000000001', GETDATE(), 'Pendiente', 1500000.00, 'operador1', 'Orden prioritaria'),
(1002, 'Venta', '1000000002', GETDATE(), 'Pendiente', 850000.50, 'operador2', NULL),
(1003, 'Compra', '1000000003', GETDATE(), 'Ejecutada', 2300000.00, 'operador1', 'Cliente VIP'),

-- Órdenes de ayer
(1004, 'Venta', '1000000001', DATEADD(DAY, -1, GETDATE()), 'Ejecutada', 1200000.00, 'operador3', NULL),
(1005, 'Compra', '1000000002', DATEADD(DAY, -1, GETDATE()), 'Ejecutada', 450000.75, 'operador2', NULL),
(1006, 'Venta', '1000000003', DATEADD(DAY, -1, GETDATE()), 'Cancelada', 980000.00, 'operador1', 'Cancelada por cliente'),

-- Órdenes de hace 3 días
(1007, 'Compra', '1000000001', DATEADD(DAY, -3, GETDATE()), 'Ejecutada', 3500000.00, 'operador1', NULL),
(1008, 'Compra', '1000000002', DATEADD(DAY, -3, GETDATE()), 'Ejecutada', 780000.25, 'operador3', NULL),
(1009, 'Venta', '1000000003', DATEADD(DAY, -3, GETDATE()), 'Pendiente', 1650000.00, 'operador2', 'Esperando confirmación'),

-- Órdenes de hace 1 semana
(1010, 'Venta', '1000000001', DATEADD(DAY, -7, GETDATE()), 'Ejecutada', 2100000.00, 'operador1', NULL),
(1011, 'Compra', '1000000002', DATEADD(DAY, -7, GETDATE()), 'Ejecutada', 560000.00, 'operador2', NULL),
(1012, 'Compra', '1000000003', DATEADD(DAY, -7, GETDATE()), 'Cancelada', 1890000.50, 'operador3', 'Sin fondos'),

-- Órdenes de hace 2 semanas
(1013, 'Venta', '1000000001', DATEADD(DAY, -14, GETDATE()), 'Ejecutada', 4200000.00, 'operador1', 'Venta programada'),
(1014, 'Compra', '1000000002', DATEADD(DAY, -14, GETDATE()), 'Ejecutada', 920000.00, 'operador2', NULL),
(1015, 'Venta', '1000000003', DATEADD(DAY, -14, GETDATE()), 'Ejecutada', 1350000.75, 'operador1', NULL),

-- Órdenes de hace 3 semanas
(1016, 'Compra', '1000000001', DATEADD(DAY, -21, GETDATE()), 'Ejecutada', 2800000.00, 'operador3', NULL),
(1017, 'Venta', '1000000002', DATEADD(DAY, -21, GETDATE()), 'Cancelada', 670000.00, 'operador2', 'Precio no alcanzado'),
(1018, 'Compra', '1000000003', DATEADD(DAY, -21, GETDATE()), 'Ejecutada', 1100000.25, 'operador1', NULL),

-- Órdenes de hace casi 1 mes
(1019, 'Compra', '1000000001', DATEADD(DAY, -28, GETDATE()), 'Ejecutada', 3100000.00, 'operador2', NULL),
(1020, 'Venta', '1000000002', DATEADD(DAY, -28, GETDATE()), 'Ejecutada', 890000.50, 'operador3', NULL),
(1021, 'Compra', '1000000003', DATEADD(DAY, -29, GETDATE()), 'Pendiente', 1450000.00, 'operador1', 'Revisión pendiente'),
(1022, 'Venta', '1000000004', DATEADD(DAY, -29, GETDATE()), 'Ejecutada', 2650000.00, 'operador2', NULL);

-- ============================================
-- Datos Mock: OrdenesDetalle
-- ============================================
-- Detalle orden 1001
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1001, 1, 1, 1000, 850.50, 850500.00, 4252.50),
(1001, 2, 2, 500, 1299.00, 649500.00, 3247.50);

-- Detalle orden 1002
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1002, 1, 3, 2000, 425.00, 850000.50, 4250.00);

-- Detalle orden 1003
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1003, 1, 5, 1500, 65.50, 98250.00, 491.25),
(1003, 2, 6, 2000, 58.75, 117500.00, 587.50),
(1003, 3, 1, 2500, 834.50, 2086250.00, 10431.25);

-- Detalle orden 1004
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1004, 1, 9, 3000, 400.00, 1200000.00, 6000.00);

-- Detalle orden 1005
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1005, 1, 10, 1500, 300.00, 450000.00, 2250.00),
(1005, 2, 11, 5, 150.75, 753.75, 3.77);

-- Detalle orden 1006
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1006, 1, 12, 800, 1225.00, 980000.00, 4900.00);

-- Detalle orden 1007
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1007, 1, 1, 2000, 875.00, 1750000.00, 8750.00),
(1007, 2, 2, 1000, 1350.00, 1350000.00, 6750.00),
(1007, 3, 13, 500, 800.00, 400000.00, 2000.00);

-- Detalle orden 1008
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1008, 1, 14, 1200, 650.00, 780000.25, 3900.00);

-- Detalle orden 1009
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1009, 1, 15, 1500, 1100.00, 1650000.00, 8250.00);

-- Detalle orden 1010
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1010, 1, 5, 3000, 70.00, 2100000.00, 10500.00);

-- Detalle orden 1011
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1011, 1, 8, 2000, 280.00, 560000.00, 2800.00);

-- Detalle orden 1012
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1012, 1, 1, 1500, 890.00, 1335000.00, 6675.00),
(1012, 2, 3, 1200, 462.50, 555000.50, 2775.00);

-- Detalle orden 1013
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1013, 1, 6, 5000, 60.00, 300000.00, 1500.00),
(1013, 2, 7, 10000, 390.00, 3900000.00, 19500.00);

-- Detalle orden 1014
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1014, 1, 9, 2300, 400.00, 920000.00, 4600.00);

-- Detalle orden 1015
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1015, 1, 10, 1500, 300.00, 450000.00, 2250.00),
(1015, 2, 11, 2000, 450.38, 900750.75, 4503.75);

-- Detalle orden 1016
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1016, 1, 2, 2000, 1400.00, 2800000.00, 14000.00);

-- Detalle orden 1017
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1017, 1, 4, 100, 6700.00, 670000.00, 3350.00);

-- Detalle orden 1018
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1018, 1, 12, 900, 1222.50, 1100250.25, 5501.13);

-- Detalle orden 1019
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1019, 1, 1, 2000, 850.00, 1700000.00, 8500.00),
(1019, 2, 5, 2000, 70.00, 140000.00, 700.00),
(1019, 3, 6, 2000, 63.00, 1260000.00, 6300.00);

-- Detalle orden 1020
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1020, 1, 13, 1100, 809.50, 890450.50, 4452.25);

-- Detalle orden 1021
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1021, 1, 14, 1000, 700.00, 700000.00, 3500.00),
(1021, 2, 15, 750, 1000.00, 750000.00, 3750.00);

-- Detalle orden 1022
INSERT INTO OrdenesDetalle (NroOrden, NroItem, EspecieId, Cantidad, Precio, Importe, Comision) VALUES
(1022, 1, 3, 5000, 530.00, 2650000.00, 13250.00);

-- ============================================
-- Crear índices para mejor rendimiento
-- ============================================
CREATE INDEX IX_Ordenes_FechaOrden ON Ordenes(FechaOrden);
CREATE INDEX IX_Ordenes_Estado ON Ordenes(Estado);
CREATE INDEX IX_Ordenes_ClienteId ON Ordenes(ClienteId);
CREATE INDEX IX_Ordenes_TipoOrden ON Ordenes(TipoOrden);
CREATE INDEX IX_OrdenesDetalle_EspecieId ON OrdenesDetalle(EspecieId);

-- ============================================
-- Verificación de datos insertados
-- ============================================
SELECT 'Clientes' as Tabla, COUNT(*) as Registros FROM Clientes
UNION ALL
SELECT 'Especies', COUNT(*) FROM Especies
UNION ALL
SELECT 'Ordenes', COUNT(*) FROM Ordenes
UNION ALL
SELECT 'OrdenesDetalle', COUNT(*) FROM OrdenesDetalle;

-- Test de las queries del ESTORD
PRINT '--- Test GetOrdenes ---';
SELECT TOP 5
    o.TipoOrden,
    o.NroOrden,
    CONVERT(VARCHAR(10), o.FechaOrden, 103) as FechaOrden,
    c.RazonSocial as Cliente,
    o.Estado,
    o.Monto,
    o.Usuario
FROM Ordenes o
INNER JOIN Clientes c ON o.ClienteId = c.Codigo
WHERE o.FechaOrden >= DATEADD(DAY, -30, GETDATE())
ORDER BY o.FechaOrden DESC, o.NroOrden DESC;

PRINT '--- Test GetTiposOrden ---';
SELECT DISTINCT TipoOrden FROM Ordenes ORDER BY TipoOrden;

PRINT '--- Test GetEstados ---';
SELECT DISTINCT Estado FROM Ordenes ORDER BY Estado;

PRINT '--- Test GetEstadisticas ---';
SELECT
    COUNT(*) as TotalOrdenes,
    SUM(CASE WHEN Estado = 'Pendiente' THEN 1 ELSE 0 END) as Pendientes,
    SUM(CASE WHEN Estado = 'Ejecutada' THEN 1 ELSE 0 END) as Ejecutadas,
    SUM(CASE WHEN Estado = 'Cancelada' THEN 1 ELSE 0 END) as Canceladas,
    SUM(Monto) as MontoTotal,
    AVG(Monto) as MontoPromedio
FROM Ordenes
WHERE FechaOrden >= DATEADD(DAY, -30, GETDATE());

PRINT '--- Test GetDetalleOrden (1007) ---';
SELECT
    d.NroItem,
    e.Descripcion as Especie,
    d.Cantidad,
    d.Precio,
    d.Importe,
    d.Comision
FROM OrdenesDetalle d
INNER JOIN Especies e ON d.EspecieId = e.EspecieId
WHERE d.NroOrden = 1007
ORDER BY d.NroItem;
