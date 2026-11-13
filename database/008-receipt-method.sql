ALTER TABLE Recebimento
  ADD COLUMN forma_pagamento ENUM('pix','cartao_credito','cartao_debito','dinheiro') NULL AFTER tipo;
