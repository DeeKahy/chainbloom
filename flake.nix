{
  description = "Chainbloom: a chain-reaction idle game (static site)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      # The built site: a directory with index.html + assets/, ready for any static file server.
      packages = forAll (pkgs: {
        default = pkgs.buildNpmPackage {
          pname = "chainbloom";
          version = "1.0.0";
          src = self;
          npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
          installPhase = ''
            runHook preInstall
            cp -r dist $out
            runHook postInstall
          '';
        };
      });

      # Exposes the built site as `config.services.chainbloom.package`, so the host's
      # Caddy config can point `root` at it. Serving (vhost, TLS) stays in the host config.
      nixosModules.default = { lib, pkgs, ... }: {
        options.services.chainbloom.package = lib.mkOption {
          type = lib.types.package;
          default = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
          description = "Built Chainbloom static site.";
        };
      };
    };
}
