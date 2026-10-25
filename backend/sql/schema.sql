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
  estado          ENUM('pendiente', 'tomada', 'finalizada', 'cancelada') NOT NULL DEFAULT 'pendiente',
  empleada_uid    VARCHAR(128) NULL,
  empleada_nombre VARCHAR(160) NULL,
  finalizada_en   TIMESTAMP    NULL,                -- cuándo la empleada terminó el trabajo
  creada          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cliente (cliente_uid),
  INDEX idx_estado (estado)
);

-- Catálogo de profesionales (se muestra en "Buscar empleadas")
CREATE TABLE IF NOT EXISTS profesionales (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre       VARCHAR(120) NOT NULL,
  oficio       VARCHAR(60)  NOT NULL,
  zona         VARCHAR(80)  NOT NULL,
  experiencia  VARCHAR(40)  NOT NULL,
  opiniones    INT UNSIGNED NOT NULL DEFAULT 0,
  comentario   VARCHAR(300) NOT NULL DEFAULT '',
  foto         VARCHAR(100) NOT NULL DEFAULT 'usuario-1.png',
  creado       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_oficio (oficio)
);

-- Perfil público de cada empleada (uno por empleada)
CREATE TABLE IF NOT EXISTS perfiles_empleada (
  empleada_uid      VARCHAR(128) PRIMARY KEY,         -- uid de Firebase de la empleada
  nombre            VARCHAR(160) NOT NULL DEFAULT '',
  descripcion       VARCHAR(600) NOT NULL DEFAULT '',
  anios_experiencia TINYINT UNSIGNED NOT NULL DEFAULT 0,
  servicios         VARCHAR(200) NOT NULL DEFAULT '', -- servicios que ofrece, separados por coma
  foto              MEDIUMTEXT   NULL,                -- imagen chica en base64 (data URL)
  actualizado       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Reseñas que dejan los clientes sobre un trabajo FINALIZADO
CREATE TABLE IF NOT EXISTS resenas (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id   INT UNSIGNED NOT NULL,
  empleada_uid   VARCHAR(128) NOT NULL,
  cliente_uid    VARCHAR(128) NOT NULL,
  cliente_nombre VARCHAR(160) NOT NULL,
  puntaje        TINYINT UNSIGNED NOT NULL,          -- de 1 a 5 estrellas
  comentario     VARCHAR(500) NOT NULL DEFAULT '',
  creada         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resena_solicitud (solicitud_id),     -- una sola reseña por trabajo
  INDEX idx_empleada (empleada_uid),
  CONSTRAINT fk_resena_solicitud FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes (id) ON DELETE CASCADE    -- si se borra la solicitud, se borra su reseña
);

-- Historial de rechazos: cada vez que una empleada devuelve un trabajo que había tomado
CREATE TABLE IF NOT EXISTS rechazos (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  solicitud_id    INT UNSIGNED NOT NULL,
  empleada_uid    VARCHAR(128) NOT NULL,
  empleada_nombre VARCHAR(160) NOT NULL DEFAULT '',
  rechazada_en    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rechazo_empleada (empleada_uid),
  CONSTRAINT fk_rechazo_solicitud FOREIGN KEY (solicitud_id)
    REFERENCES solicitudes (id) ON DELETE CASCADE    -- si se borra la solicitud, se borran sus rechazos
);
