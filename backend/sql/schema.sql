-- Base de datos del backend de Limpieza
-- (El backend la crea solo al arrancar; este archivo es para verla o crearla a mano)

CREATE DATABASE IF NOT EXISTS limpieza
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE limpieza;

-- Objeto de negocio: solicitudes de servicio que hacen los clientes
CREATE TABLE IF NOT EXISTS solicitudes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cliente_uid     VARCHAR(128) NOT NULL,          -- uid de Firebase del cliente
  nombre          VARCHAR(80)  NOT NULL,
  apellido        VARCHAR(80)  NOT NULL,
  correo          VARCHAR(120) NOT NULL,
  telefono        VARCHAR(20)  NOT NULL,
  direccion       VARCHAR(200) NOT NULL,
  requerimientos  TEXT         NOT NULL,
  planchar        BOOLEAN      NOT NULL DEFAULT FALSE,
  lavar           BOOLEAN      NOT NULL DEFAULT FALSE,
  cocina          BOOLEAN      NOT NULL DEFAULT FALSE,
  cuidado_ninos   BOOLEAN      NOT NULL DEFAULT FALSE,
  cama_adentro    BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha           DATE         NOT NULL,
  horario         VARCHAR(30)  NOT NULL,
  frecuencia      VARCHAR(40)  NOT NULL,
  estado          ENUM('pendiente', 'tomada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  empleada_uid    VARCHAR(128) NULL,
  empleada_nombre VARCHAR(160) NULL,
  creada          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cliente (cliente_uid),
  INDEX idx_estado (estado)
);
