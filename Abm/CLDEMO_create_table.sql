-- Tabla para ABM embebido demo: Contactos de Clientes (CLDEMO)
-- FK a Clientes.Codigo (padre: CLIDMO)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ClientesContactos')
BEGIN
    CREATE TABLE ClientesContactos (
        CodigoCliente   VARCHAR(10)   NOT NULL,
        NroContacto     VARCHAR(10)   NOT NULL,
        Nombre          VARCHAR(80)   NOT NULL,
        Telefono        VARCHAR(40)   NULL,
        Email           VARCHAR(120)  NULL,
        Cargo           VARCHAR(60)   NULL,
        CONSTRAINT PK_ClientesContactos PRIMARY KEY (CodigoCliente, NroContacto)
    )
END
